import { request } from 'express';
import { ApiResponse } from '@nestjs/swagger';
import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  Headers,
  SetMetadata,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport'; // Es el Guard que trabaja con passport

import { AuthService } from './auth.service';
import { LoginUserDto } from './dto/login-user.dto';
//import { User } from './schemas/user.schema';
import { User } from '../users/schemas/user.schema';
import { IncomingHttpHeaders } from 'http';
import { UserRoleGuard } from './guards/user-role.guard';
import { ValidRoles } from './interfaces';
import { CreateUserDto } from 'src/users/dto';

import {
  EmailTest,
  HeadersTest,
  RoleProtected,
  Auth,
  GetUser,  // No puedo usar este decorador si antes no aplique el decorador Auth, porque si no esta autenticado no existe el usuario que queremos recuperar.
} from './decorators';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiResponse({ status:201, description: 'User was registered', type: User })
  @ApiResponse({ status:400, description: 'Bad request' })
  registerUser(@Body() createUserDto: CreateUserDto) {
    return this.authService.register(createUserDto);
  }

  @Post('login')
  @ApiResponse({ status:201, description: 'User logged in', type: User }) // Type es lo que retorna
  @ApiResponse({ status:400, description: 'Bad request' })
  @ApiResponse({ status:401, description: 'User is inactive, talk with an admin' })
  loginUser(@Body() loginUserDto: LoginUserDto) {
    return this.authService.login(loginUserDto);
  }

  // Revalida el token que nos envian y lo renueva. Para el caso que el usuario renueve la aplicacion y le siga asignando un token.
  @Get('check-status')
  @ApiResponse({ status:200, description: 'Check-status OK', type: User }) // Type es lo que retorna
  @ApiResponse({ status:400, description: 'Bad request' })
  @ApiResponse({ status:401, description: 'Unauthorized'})
  @Auth()
  checkAuthStatus(@GetUser() user: User) {
    return this.authService.checkAuthStatus(user);
  }

  @Get('private')
  @ApiResponse({ status:200, description: 'Access to private route OK', type: User }) // Type es lo que retorna
  @ApiResponse({ status:401, description: 'Unauthorized'})
  @UseGuards(
    // UseGuards: Incorpora una lista de Guards. Dentro de aca incorporamos guards que puden ser llamados con el @ o no, eso depende del tipo de guard
    AuthGuard(), // AuthGuard de passport hace la validacion del token y nuestra estrategia. *** Y agrega automaticamente user al contexto y al request. ***
  )
  testingPrivateRoute() // ** DECORADORES DE PARAMETROS ** No se pueden generar decoradore de parametro con: nest g de xxx. Eso es para decoradores globales o de metodos.
  // Aca se llaman los decoradores de parametros.
  // @Req() request:Express.Request,          // Asi podriamos acceder a la request pero lo hacemos de la siguiente manera
  //@GetUser() user: User, // Decorador pers de parametros que extre el usuario del contexto. En el decorador explicacion de porque esxtraemos aca el req.
  //@EmailTest('email') email: User, // Decorador pers de practica, si no le mando el parametro email no lo paso. Podria pasar un arreglo si quiero.
  //@HeadersTest('email') headersTest: string[], // Decorador pers de practica, obtengo los headers
  //@Headers() headers: IncomingHttpHeaders, // Decorador propio de nest para obtener los headers
  {
    //console.log(user)
    //console.log(email)
    //console.log(headersTest)
    //console.log(headers)
    // return {
    //   ok: true,
    //   messaage: 'Route PRIVATE OK',
    //   user,
    // };
    return {
      acceso: 'Autorizado',
      messaage:
        'Route PRIVATE. Acceso sin restricción, solo debe estar logueado',
    };
  }

  @Get('private1')
  @ApiResponse({ status:200, description: 'Access to private route 1 OK', type: User }) // Type es lo que retorna
  @ApiResponse({ status:401, description: 'Unauthorized'})
  @ApiResponse({ status:403, description: 'Forbidden, Valid roles: [USER,OPERATOR]'})
  // ** DECORADORES DE METODO **
  //@SetMetadata('rolesTest',['admin','super-admin'])     // Decorador de practica. Este deco de metadata es propio de nest, Es para agregar informacion y luego accederla desde un decorador. Accedemos a esta metadata en el guard UserRoleGuard para chequear el rol de usuario.
  @RoleProtected(ValidRoles.USER, ValidRoles.OPERATOR) // Decorador pers, le pasamos los roles validos para esta ruta. Es lo mismo de lo de arriba pero ahora le pasamos los argumento obtenidos desde un enum y la metadata se agrega a travez de este decorador personalizado.
  @UseGuards(
    AuthGuard(), // Este Guard es el de passport y se instacia por eso se lo llama con (), los guards pers como los de acontinuacion no se instacian.
    UserRoleGuard,
  )
  testingPrivateRoute1() {
    return {
      acceso: 'Autorizado',
      messaage: 'Route PRIVATE 1, ACCESO PARA USUARIOS: USER Y OPERADOR',
    };
  }

  @Get('private2')
  @ApiResponse({ status:200, description: 'Access to private route 2 OK', type: User }) // Type es lo que retorna
  @ApiResponse({ status:401, description: 'Unauthorized'})
  @ApiResponse({ status:403, description: 'Forbidden, Valid roles: [ADMIN]'})
  // ** DECORADORES DE METODO **
  //@SetMetadata('rolesTest',['admin','super-admin'])     // Decorador de practica. Este deco de metadata es propio de nest, Es para agregar informacion y luego accederla desde un decorador. Accedemos a esta metadata en el guard UserRoleGuard para chequear el rol de usuario.
  @RoleProtected(ValidRoles.ADMIN) // Decorador pers, le pasamos los roles validos para esta ruta. Es lo mismo de lo de arriba pero ahora le pasamos los argumento obtenidos desde un enum y la metadata se agrega a travez de este decorador personalizado.
  @UseGuards(
    AuthGuard(), // Este Guard es el de passport y se instacia por eso se lo llama con (), los guards pers como los de acontinuacion no se instacian.
    UserRoleGuard,
  )
  testingPrivateRoute2() {
    return {
      acceso: 'Autorizado',
      messaage: 'Route 2, ACCESO PARA USUARIOS: ADMIN',
    };
  }

  // En esta ruta reemplazamos el decorador de @RoleProtected  y  @UseGuards(AuthGuard(), UserRoleGuard,)
  // por el decorador personalizado que une los 2.
  // por lo tanto este hace la validacion de passport, el guard de passport y la autorizacion de roles.
  @Get('private3')
  @ApiResponse({ status:200, description: 'Access to private route 3 OK', type: User }) // Type es lo que retorna
  @ApiResponse({ status:401, description: 'Unauthorized'})
  @ApiResponse({ status:403, description: 'Forbidden, Valid roles: [SUPERADMIN]'})
  //@Auth()  // Si lo dejara vacio podria cualquier rol acceder paro si o si tiene que estar autenticado porque esto involucra el guar de jwt.
  @Auth(ValidRoles.SUPERADMIN)
  privateRoute3(@GetUser() user: User) {
    return {
      acceso: 'Autorizado',
      messaage:
        'Route 3, ACCESO PARA USUARIOS: SUPERADMIN. Esta ruta incluye el decorador "@GetUser() user: User" para obtener el usuario y agregarlo al request. ',
      user,
    };
  }
}
