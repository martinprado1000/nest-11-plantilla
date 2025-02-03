import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';

import * as bcrypt from 'bcrypt';
import { plainToInstance } from 'class-transformer';
import { InjectModel } from '@nestjs/mongoose';
import { Document as DocumentMongoose, isValidObjectId, Model } from 'mongoose';

import { User } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ResponseUserDto } from './dto/response-user.dto';
import { ConfigService } from '@nestjs/config';
import { PaginationDto } from '../common/dtos/pagination.dto';
import { CustomLoggerService } from 'src/logger/logger.service';

@Injectable()
export class UsersService {
  //private readonly logger = new Logger('UsersService'); // Genera un logger para este servicio.
  private defaultLimit: number;
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private readonly configService: ConfigService,
    private readonly logger: CustomLoggerService,
  ) {
    this.defaultLimit = configService.get<number>('pagination.defaultLimit', 3); // Le pongo un limite default para poder tipar.
  }

  // -----------FIND ALL---------------------------------------------------------------------------------
  async findAll(paginationDto: PaginationDto) {
    const { limit = this.defaultLimit, offset = 0 } = paginationDto;
    return await this.userModel
      .find()
      .skip(offset) // Salta los primeros `offset` registros
      .limit(limit);
  }
  // -----------FIND ALL RESPONSE-------------------------------------------------------------
  async findAllResponse(paginationDto: PaginationDto) { 
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
  async findOne(term: string) {
    let user: DocumentMongoose | null ;

    if (isValidObjectId(term)) {
      user = await this.userModel.findById(term).lean();
    } else {
      user = await this.userModel.findOne({ email: term }).lean();
    }

    if (!user) throw new NotFoundException(`No se encontro el usuario ${term}`);
    
    
    return plainToInstance(CreateUserDto,user);    
  }
  // -----------FIND ONE RESPONSE------------------------------------------------------------
  async findOneResponse(term: string) {
    const user = await this.findOne(term);

    return plainToInstance(ResponseUserDto,user,{
      // Paso por el metodo ResponseUserDto para retornar el objeto editado, se lo paso como objeto plano de javaScript
      excludeExtraneousValues: true, // Excluye propiedades NO marcadas con @Expose en el response-user.dto
    },); 
  }

  // -----------CREATE------------------------------------------------------------------------------------
  async create(createUserDto: CreateUserDto): Promise<ResponseUserDto> {
    let { password, confirmPassword } = createUserDto;

    if (password != confirmPassword)
      throw new BadRequestException('Las contraseñas no coinciden');

    //delete confirmPassword;

    // Esto no lo hago porque si no puedo crear el usuario nos lanza una excepcion y la manejamos en el catch.
    // const userExist = await this.findOne(email);
    // if (userExist) throw new ConflictException(`The user already exists`);

    const hashedPassword: string = await bcrypt.hash(password, 10);

    createUserDto.password = hashedPassword;

    try {
      let user = await this.userModel.create(createUserDto) as DocumentMongoose; // Tipeo el dato como un documento de mongoose.

      const userResponse: ResponseUserDto = plainToInstance( ResponseUserDto, user.toObject(), {
          excludeExtraneousValues: true,
        },
      );
      return userResponse;
    } catch (error) {
      this.handleDBErrors(error);
    }
  }

  // -----------UPDATE-------------------------------------------------------------------------------
  // async update2(id: string, updateUserDto: UpdateUserDto) {
  //   let { password, confirmPassword } = updateUserDto;

  //   if (password || confirmPassword) {
  //     if (password != confirmPassword)
  //       throw new BadRequestException('Las contraseñas no coinciden');

  //     const hashedPassword = await bcrypt.hash(password, 10);
  //     updateUserDto.password = hashedPassword;
  //   }

  //   try {
  //     const updatedUser = await this.userModel.findByIdAndUpdate(
  //       id,
  //       updateUserDto,
  //       {
  //         new: true, // {new:true}  es para que me retorne el objeto ya editado
  //       },
  //     );

  //     if (!updatedUser) {
  //       throw new NotFoundException(`Usuario con id: ${id} no encontrado`);
  //     }

  //     const updatedUserResponse = plainToInstance(
  //       ResponseUserDto,
  //       updatedUser.toObject(),
  //       {
  //         // Paso por el metodo ResponseUserDto para retornar un objeto editado sin el password, se lo paso como objeto plano de javaScript
  //         excludeExtraneousValues: true, // Excluye propiedades NO marcadas con @Expose
  //       },
  //     );

  //     return updatedUserResponse;
  //   } catch (error) {
  //     this.handleDBErrors(error);
  //   }
  // }
  async update(id: string, updateUserDto: UpdateUserDto) {
    let { password, confirmPassword } = updateUserDto;

    let updatedUser: DocumentMongoose | null;
  
    if (password || confirmPassword) {
      if (password !== confirmPassword)
        throw new BadRequestException('Las contraseñas no coinciden');
  
      const hashedPassword = await bcrypt.hash(password, 10);
      updateUserDto.password = hashedPassword;
    }
    
    try {
      updatedUser = await this.userModel.findByIdAndUpdate(id, updateUserDto, {
        new: true,
      });
    
    } catch (error) {
      this.handleDBErrors(error);
    }
  
    if (!updatedUser) {
      throw new NotFoundException(`Usuario con id: ${id} no encontrado`);
    }
  
    return plainToInstance(ResponseUserDto, updatedUser.toObject(), {
      excludeExtraneousValues: true,
    });
  }

  // -----------DELETE-------------------------------------------------------------------------------
  async remove(id: string, user: User) {
    let deletedUser: CreateUserDto | null;

    try {
      deletedUser = await this.userModel.findByIdAndDelete(id);
      this.logger.http(`El usuario ${user.email} eliminó al usuario con id ${id}`, UsersService.name);
      this.logger.error('This is an error', UsersService.name, "Error detail");
      this.logger.warn('This is a warning', UsersService.name,);
      this.logger.log('This is an info log', UsersService.name,);
      this.logger.debug('This is a debug',  UsersService.name);
      this.logger.verbose('This is a verbose',  UsersService.name);
    } catch (error) {
      this.handleDBErrors(error);
    }
    if (!deletedUser)
      throw new NotFoundException(`Usuario con id: ${id} no encontrado`);

    return `Usuario con id: ${id} eliminado`
  }

    // -----------DELETE ALL USERS-------------------------------------------------------------------------------
    // Elimina todos los uausuarios para poder eliminar el documento
    async removeAllUsers() {
      try {
        await this.userModel.deleteMany();
      } catch (error) {
        this.handleDBErrors(error);
      }
    }

    // -----------DELETE DATA BASE USERS-------------------------------------------------------------------------------
    async deleteUsersCollection(): Promise<string> {
      try {
        await this.userModel.collection.drop();
        return 'Colección de productos eliminada con éxito';
      } catch (error) {
        throw new Error('No se pudo eliminar la colección');
      }
    }

  // -----------GENERETE SEED USERS-------------------------------------------------------------------------------
  async genereteSeedUsers(createUserDto: CreateUserDto) {
    const seedUsers = await this.create(createUserDto);
    return seedUsers;
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
