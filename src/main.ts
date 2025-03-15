import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
//import * as morgan from 'morgan';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('bootstrap')

  app.setGlobalPrefix('api')  // A todas las rutas le agrega este prefijo antes
  
  app.enableCors();

  app.useGlobalPipes(new ValidationPipe({
    whitelist:true,  // Esta linea lo que hace es que si me mandan datos de mas que no los reciba.
    forbidNonWhitelisted: true, // Retorna el error si nos envian datos de mas.
    transform:true,      //convertir automáticamente los datos recibidos (por ejemplo, de un req.body) al tipo definido en el DTO.
    transformOptions:{   //conversión implícita de tipos sin necesidad de usar el decorador @Type() de class-transformer.
      enableImplicitConversion: true,
    }
  })); 

  // Swagger
  // En la version nueva los tags se cargan automaticamente.
  const config = new DocumentBuilder()
    .setTitle('Plantilla RESTFul API')
    .setDescription('Plantilla endpoints')
    .setVersion('1.0')
    //.addTag('Default') // Esto lo hace automatico en la nueva version, agrega el tag correspondiente al endpoint.
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);  
  SwaggerModule.setup('api', app, documentFactory);

  // Morgan
  // app.use(
  //   morgan((tokens, req, res) => {
  //     return [
  //       `[${tokens.method(req, res)}]`, // Método HTTP (GET, POST, etc.)
  //       tokens.url(req, res), // Ruta
  //       `[Host: ${req.get('host') || 'unknown-host'}]`, // Host de la petición
  //       `[Status: ${tokens.status(req, res)}]`, // Código de respuesta
  //       `[Time: ${tokens['response-time'](req, res)} ms]`, // Tiempo de respuesta
  //     ].join(' ');
  //   }),
  // );

  const configService = app.get(ConfigService) // Obtengo las variables de entorno desde: import { ConfigService } from '@nestjs/config';
 
  const PORT = configService.get<number>('port')
  
  await app.listen(Number(PORT)); // El valor por defecto en el caso que no lo este en el .env lo obtiene del envSchema
  
  logger.log(`App runing on port ${PORT}`)

}
bootstrap();
