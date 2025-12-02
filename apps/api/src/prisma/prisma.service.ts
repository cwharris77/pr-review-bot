import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private prismaClient: any;

  async onModuleInit() {
    const { PrismaClient } = await import('@prisma/client');
    this.prismaClient = new PrismaClient();
    await this.prismaClient.$connect();
  }

  async onModuleDestroy() {
    await this.prismaClient?.$disconnect();
  }

  get review() {
    return this.prismaClient.review;
  }
}
