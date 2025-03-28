import { Controller, Get } from '@nestjs/common';
import { SeedService } from './seed.service';
import { Auth } from '../auth/decorators';
import { ValidRoles } from '../auth/interfaces';
import { ApiResponse } from '@nestjs/swagger';

@Controller('seed')
export class SeedController {
  constructor(private readonly seedService: SeedService) {} 

  @Get('executeSeed')
  @ApiResponse({ status: 200, description: 'Seed executed'}) // Type es lo que retorna
  @ApiResponse({ status: 403, description: 'Forbidden, token related' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Auth(ValidRoles.SUPERADMIN)
  executeSeed() {
    return this.seedService.runSeed(); 
  } 
}
