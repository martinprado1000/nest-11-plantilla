import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto';
import { Auth, GetUser } from '../auth/decorators';
import { CustomLoggerService } from 'src/logger/logger.service';
import { PaginationDto } from '../common/dtos/pagination.dto';
import { idMongoPipe } from '../common/pipes/idMongo.pipe';
import { ValidRoles } from 'src/auth/interfaces';
import { ApiResponse, ApiTags } from '@nestjs/swagger';

//@ApiTags('Asi podria cambiar el titulo de estos endpoints de Swager') //Swagger: @ApiTags= Asi podria cambiar el titulo de estos endpoints, si no tomo el nomber del endpoint.
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly logger: CustomLoggerService,
  ) {}

  // @Get('genereteSeedUsers')
  // async genereteSeedUsers(
  // ) {
  //   return await this.usersService.genereteSeedUsers();
  // }

  // @Get('removeAllUsers')
  // async removeAllUsers(
  // ) {
  //   return await this.usersService.removeAllUsers();
  // }

  // @Get('deleteUsersCollection')
  // async DeleteUsersCollection(
  // ) {
  //   return await this.usersService.deleteUsersCollection();
  // }

  @Get()
  @ApiResponse({ status: 200, description: 'Users list', type: CreateUserDto }) //Swagger: @ApiResponse: respuestas posible, Type es lo que retorna
  @ApiResponse({ status: 400, description: 'Bad request' })
  //@Auth(ValidRoles.SUPERADMIN, ValidRoles.ADMIN)
  async findAll(@Query() paginationDto: PaginationDto) {
    return await this.usersService.findAllResponse(paginationDto);
  }

  @Get(':term') // term: termino de busqueda porquelo puedo buscar por email o id
  @ApiResponse({ status: 200, description: 'Users list by term', type: CreateUserDto }) // Type es lo que retorna
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  //@Auth(ValidRoles.SUPERADMIN, ValidRoles.ADMIN)
  async findOne(@Param('term') term: string) {
    return await this.usersService.findOneResponse(term);
  }

  @Post()
  @ApiResponse({ status: 201, description: 'User was created', type: CreateUserDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden, token related' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Auth(ValidRoles.SUPERADMIN, ValidRoles.ADMIN)
  async create(
    @Body() createUserDto: CreateUserDto,
    @GetUser() user: CreateUserDto
  ) {
    return await this.usersService.create(createUserDto, user); 
  }

  @Patch(':id')
  @ApiResponse({ status: 200, description: 'User was updated', type: UpdateUserDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 403, description: 'Forbidden, token related' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Auth(ValidRoles.SUPERADMIN, ValidRoles.ADMIN)
  async update(
    @Param('id', idMongoPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
    @GetUser() user: CreateUserDto,
  ) {
    return await this.usersService.update(id, updateUserDto, user);
  }

  // Este endpoint no elimina, pasa el usuario a inactivo.
  @Delete(':id')
  @ApiResponse({ status: 204, description: 'User was deleted'})
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 403, description: 'Forbidden, token related' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Auth(ValidRoles.SUPERADMIN, ValidRoles.ADMIN)
  @HttpCode(204) // Si retorno un codigo 204 por mas que haga un return no retorna nada, si retorna las excepciones.
  async remove(
    @Param('id', idMongoPipe) id: string, 
    @GetUser() user: CreateUserDto
  ) {
    return await this.usersService.userIsActiveFalse(id, user);
  }

}
