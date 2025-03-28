import { Injectable, InternalServerErrorException } from '@nestjs/common';

import { initialData } from './data/seed-data';
import { UsersService } from '../users/users.service';

@Injectable()
export class SeedService {
  constructor(
    private readonly usersService: UsersService,
  ) {}

  // Run seed.
  async runSeed() {
    try {
      const deleteData = await this.deleteData();
      console.log(deleteData);
      // IMPORTANT: If the collection is deleted, the indexes are not created because it already inserts users before creation.
      //const deleteCollections = await this.deleteCollections();
      //console.log(deleteCollections);
      const insertUserData = await this.insertUsersData();
      console.log(insertUserData);
      return 'SEED EXECUTED'; 
    } catch (error) {
      throw new InternalServerErrorException('Please check server logs');
    }
  }

  // Delete users
  private async deleteData() {
    return await this.usersService.removeAllUsers();
  }

  // Delete colecctions
  private async deleteCollections() {
    return await this.usersService.deleteUsersCollection();
  }

  // Insets hardcode data
  private async insertUsersData() {
    const seedUsers = initialData.users;
    seedUsers.forEach((user) => {
      this.usersService.create(user); 
    });
    return 'Usuarios creados con éxito';
  }

}
