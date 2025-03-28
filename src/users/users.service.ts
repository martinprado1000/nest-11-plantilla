import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import * as bcrypt from 'bcrypt';
import { plainToInstance } from 'class-transformer';
import { Document as DocumentMongoose, isValidObjectId } from 'mongoose';

import { PaginationDto } from '../common/dtos/pagination.dto';
import { User } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ResponseUserDto } from './dto/response-user.dto';
import { Role } from './enums/role.enums';
import { USERS_REPOSITORY_INTERFACE, UsersRepositoryInterface } from './interfaces/users-repository.interface';
import { CustomLoggerService } from '../logger/logger.service';

// this.logger.error('UsersService.name, `Mensaje error`, 'Traza error');
// this.logger.warn('UsersService.name, `Mensaje warn`, 'Traza warn');
// this.logger.log('UsersService.name, `Mensaje log`, 'Traza log');       // info
// this.logger.http('UsersService.name, `Mensaje http`,`Traza http`);
// this.logger.verbose('UsersService.name, `Mensaje verbose`, 'Traza Verbose');
// this.logger.debug('UsersService.name, `Mensaje debug`, 'Traza debug');
// this.logger.silly('UsersService.name, `Mensaje silly`, 'Traza silly');
// Ejemplo de logger: 
                    // Servicio         // Mensaje                                    // Traza
// this.logger.http(UsersService.name, `Usuario ${user._id} editó al usuario ${id}`, `PATCH/${id}`);

@Injectable()
export class UsersService {
  //private readonly logger = new Logger('UsersService'); // Genera un logger para este servicio. Ya no lo usamos asi, usamos el log personalizado.
  private defaultLimit: number;

  constructor(

    private readonly configService: ConfigService,

    // Inyectamos el usersRepository de la siguiente manera para usar la interface.
    @Inject(USERS_REPOSITORY_INTERFACE) private readonly usersRepository: UsersRepositoryInterface,
    
    private readonly logger: CustomLoggerService,

  ) {
    this.defaultLimit = configService.get<number>('pagination.defaultLimit', 3); // Le pongo un limite default para poder tipar.
  }

  // -----------FIND ALL---------------------------------------------------------------------------------
  async findAll(paginationDto: PaginationDto): Promise<User[]> {
    const { limit = this.defaultLimit, offset = 0 } = paginationDto;
    return await this.usersRepository.findAll(limit, offset);
  }

  // -----------FIND ALL RESPONSE-------------------------------------------------------------
  async findAllResponse(paginationDto: PaginationDto): Promise<ResponseUserDto[]> {
    const users = await this.findAll(paginationDto);
    return plainToInstance(
      ResponseUserDto,
      users.map((user) => user.toObject()),
      {
        // Paso por el metodo ResponseUserDto para retornar un objeto editado sin el password, se lo paso como objeto plano de javaScript
        excludeExtraneousValues: true, // Excluye propiedades NO marcadas con @Expose en el response-user.dto
      },
    );
  }

  // -----------FIND ONE-------------------------------------------------------------------------------
  async findOne(term: string): Promise<CreateUserDto> { // No le tipeo como idMongoPipe porque el term puede ser el email
    let user: DocumentMongoose | null;

    if (isValidObjectId(term)) {
      user = await this.usersRepository.findById(term);
    } else {
      user = await this.usersRepository.findeByEmail(term);
    }
    if (!user) throw new NotFoundException(`No se encontró el usuario con id: ${term}`);

    return plainToInstance(CreateUserDto, user);
  }
  // -----------FIND ONE RESPONSE------------------------------------------------------------
  async findOneResponse(term: string): Promise<ResponseUserDto> {
    const user = await this.findOne(term);

    return plainToInstance(ResponseUserDto, user, {
      // Paso por el metodo ResponseUserDto para retornar el objeto editado, se lo paso como objeto plano de javaScript
      excludeExtraneousValues: true, // Excluye propiedades NO marcadas con @Expose en el response-user.dto
    });
  }

  // -----------CREATE------------------------------------------------------------------------------------
  async create(createUserDto: CreateUserDto, activeUser?: CreateUserDto ): Promise<ResponseUserDto> { // El user puede venir o no porque si es un register no viene.
    
    await this.isSuperadminCreate(createUserDto, activeUser);
    
    let { password, confirmPassword } = createUserDto;
    
    if (password != confirmPassword)
      throw new BadRequestException('Las contraseñas no coinciden');  

    // Esto no lo hago porque si no puede crear el usuario nos lanza una excepcion en el create y ahi ya maneja la excepcion.
    // const userExist = await this.findOneResponse(email);
    // if (userExist) throw new ConflictException(`The user already exists`);

    const hashedPassword: string = await bcrypt.hash(password, 10);

    createUserDto.password = hashedPassword;

    try {
      let user = await this.usersRepository.create(createUserDto)

      const userResponse: ResponseUserDto = plainToInstance(
        ResponseUserDto,
        user.toObject(),
        {
          excludeExtraneousValues: true,
        },
      );

      this.logger.http(UsersService.name, `Usuario ${user._id} creó al usuario ${userResponse.id}`, `POST/${userResponse.id}`);
      
      // Esto lo estoy ejecutando en el decorador interceptor @UseInterceptors(AuditInterceptor) que se ejecuta desde el controllador.
      // const createAuditLogDto: CreateAuditLogsDto = { 
      //   entityAfected: UsersService.name,
      //   entityAfectedId: userResponse.id,
      //   userIdAction: activeUser ? activeUser?._id : 'Registración por usuario',
      //   action: Action.CREATE,
      //   afterData: userResponse,
      // }
      // await this.auditLogsService.crate(createAuditLogDto);

      return userResponse;
    } catch (error) {
      this.handleDBErrors(error);
    }
  }
  
  // -----------UPDATE------------------------------------------------------------------------------------
  async update(id: string, updateUserDto: UpdateUserDto, activeUser: CreateUserDto): Promise<ResponseUserDto> {
    await this.isSuperadminEdit(id, activeUser);

    let { password, confirmPassword } = updateUserDto;

    let updatedUser: DocumentMongoose | null;

    if (password || confirmPassword) {
      if (password !== confirmPassword)
        throw new BadRequestException('Las contraseñas no coinciden');

      const hashedPassword = await bcrypt.hash(password, 10);
      updateUserDto.password = hashedPassword;
    }

    try {
      updatedUser = await this.usersRepository.update(id, updateUserDto)

    } catch (error) {
      this.handleDBErrors(error);
    }

    if (!updatedUser) {
      throw new NotFoundException(`Usuario con id: ${id} no encontrado`);
    }

    const updatedUserPlain = plainToInstance(ResponseUserDto, updatedUser.toObject(), {
      excludeExtraneousValues: true,
    });

    this.logger.http(UsersService.name, `Usuario ${activeUser._id} editó al usuario ${id}`, `PATCH/${id}`);

    return updatedUserPlain
  }

  // -----------DELETE-------------------------------------------------------------------------------
  async delete(id: string, activeUser: CreateUserDto): Promise<string> {
    // Usuario ADMIN no puede eliminar un usuario SUPERADMIN
    await this.isSuperadminEdit(id, activeUser);// Esto lo puedo ejecutar fuera del try porque lanzaria la excepcion en el metodo fingOneResponse.

    let deletedUser: DocumentMongoose | null;
    
    try {
      deletedUser = await this.usersRepository.delete(id);

      this.logger.http(UsersService.name, `Usuario ${activeUser._id} eliminó al usuario ${id}`, `DELETE/${id}`);
      //this.logger.http(`Usuario ${user.id} eliminó definitivo al usuario ${id}`, UsersService.name);

    } catch (error) {
      this.handleDBErrors(error);
    }
    //if (!deletedUser)
    //  throw new NotFoundException(`Usuario con id: ${id} no encontrado`);

    return `Usuario con id: ${id} eliminado`;
  }

  // -----------USER ISACTIVE FALSE-------------------------------------------------------------------------------
  async userIsActiveFalse(id: string, activeUser: CreateUserDto ): Promise<ResponseUserDto>{
  
    // Usuario ADMIN no puede eliminar un usuario SUPERADMIN
    await this.isSuperadminEdit(id, activeUser);
    
    const userUpdated = await this.update(id, {isActive:false}, activeUser);

    this.logger.http(UsersService.name, `Usuario ${activeUser._id} paso a inactivo al usuario ${id}`, `DELETE/${id}`);

    return userUpdated;
  }

  // -----------DELETE ALL USERS-------------------------------------------------------------------------------
  // Elimina todos los usuarios para poder eliminar la coleccion.
  async removeAllUsers(): Promise<string> {
    try {
      this.usersRepository.deleteAllUsers();
      this.logger.http(UsersService.name, `Documentos de la collecciín users eliminada`);
      return 'Documentos de la collecciín users eliminada con éxito';
    } catch (error) {
      throw new Error(
        'No se pudo eliminar los documentos de la colección users',
      );
    }
  }

  // -----------DELETE COLLECTION USERS-------------------------------------------------------------------------------
  // Elimina la colleción users.
  async deleteUsersCollection(): Promise<string> {
    try {
      this.usersRepository.deleteUsersCollection();
      this.logger.http(UsersService.name, `Colección users eliminada`);
      return 'Colección users eliminada con éxito';
    } catch (error) {
      throw new Error('No se pudo eliminar la colección users');
    }
  }

  // -----------GENERETE SEED USERS-------------------------------------------------------------------------------
  // Crea usuario hadcodeados en la coleccion users.
  // async genereteSeedUsers(createUserDto: CreateUserDto): Promise<ResponseUserDto> {
  //   try {
  //     return await this.create(createUserDto);
  //   } catch (error) {
  //     throw new Error('No se pudo crear la colección users');
  //   }
  // }

  private async isSuperadminEdit(id: string, userActive: CreateUserDto ): Promise< void | string > {
    const userToDelete = await this.findOneResponse(id)
    if ( !userActive.roles?.includes(Role.SUPERADMIN) && userToDelete.roles.includes(Role.SUPERADMIN)) throw new BadRequestException('Operación no permitida: No puede modificar un usuario SUPERADMIN')
    return
  }

  private async isSuperadminCreate(createUserDto: CreateUserDto, userActive?: CreateUserDto ): Promise< void | string > {
    if ( !userActive?.roles?.includes(Role.SUPERADMIN) && createUserDto.roles?.includes(Role.SUPERADMIN)) throw new BadRequestException('Operación no permitida: No puede crear un usuario SUPERADMIN')
    return
  }

  private handleDBErrors(error: any): never {
    // Esta funcion retorna never porque nunca va a retornar nada. Solo puede lanzar una axection.
    if (error.code === 11000)
      throw new BadRequestException(
        `El usuario ${JSON.stringify(error.keyValue.email)} ya existe`,
      );

    throw new InternalServerErrorException('Please check server logs');
  }
}
