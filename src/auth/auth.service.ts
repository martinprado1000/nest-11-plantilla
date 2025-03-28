import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt'; // Importamos jwt

import * as bcrypt from 'bcrypt';
import { plainToInstance } from 'class-transformer';

import { JwtPayload } from './interfaces/jwt-payload.interface';
import { LoginUserDto } from './dto/login-user.dto';
//import { User } from './schemas/user.schema';
import { User } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { CreateUserDto, ResponseUserDto } from '../users/dto';
import { Role } from 'src/users/enums/role.enums';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UsersService,
    private readonly jwtService: JwtService, // Este es el modulo de jwt que interactua con el jwtModulo creado por nosotros
  ) {}

  // -----------REGISTER-------------------------------------------------------------------------------
  async register(createAuthDto: CreateUserDto) {
    if (JSON.stringify(createAuthDto.roles) !== JSON.stringify([Role.USER])) {
      throw new BadRequestException(
        'Operación no permitida: Solo se pueden registrar usuarios de tipo: USER',
      );
    }

    const userResponse = await this.userService.create(createAuthDto);

    return {
      ...userResponse,
      token: this.getJwtToken({ id: userResponse.id }),
    };
  }

  async login(loginAuthDto: LoginUserDto) {
    let userResponse: ResponseUserDto 
    const { password, email } = loginAuthDto;

    const user = await this.userService.findOne(email);

    if (user?.isActive === false)
      throw new UnauthorizedException('User is inactive, talk with an admin');

    if (!bcrypt.compareSync(password, user.password))
      throw new UnauthorizedException('Credential are not valid (password)');
    //delete user.password

    userResponse = plainToInstance(ResponseUserDto,user,{
      // Paso por el metodo ResponseUserDto para retornar el objeto editado, se lo paso como objeto plano de javaScript
      excludeExtraneousValues: true, // Excluye propiedades NO marcadas con @Expose en el response-user.dto
    },); 

    // Si la registración fue correcta retornamos el usuario y el token.
    if (user._id){ // Aunque ya se que el id existe hago la validacion para que pase la validación del tipo de dato.
      return {
        ...userResponse,
        token: this.getJwtToken({ id: user._id }),
      };
    }
  }

  // Este metodo es para revalidarle el jwt en el caso que este validado pero pierda en token en un refresco de pantalla.
  async checkAuthStatus(user: User) {
    return {
      ...user,
      token: this.getJwtToken({ id: user.id }),
    };
  }

  // Este es nuestro metodo que genera el token
  private getJwtToken(payload: JwtPayload) {
    const token = this.jwtService.sign(payload);
    return token;
  }
  
}
