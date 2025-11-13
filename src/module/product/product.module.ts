import { Module } from '@nestjs/common';
import { ProductService } from './product.service';
import { ProductRepository } from './product.repository';

@Module({
    providers: [ProductService, ProductRepository],
    exports: [ProductService],
})
export class ProductModule {}
