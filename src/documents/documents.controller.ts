import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  /** Submit a document for ingestion; returns a jobId immediately (async). */
  @Post()
  @HttpCode(202)
  async create(@Body() dto: CreateDocumentDto): Promise<{ jobId: string; documentId: string }> {
    return this.documents.create(dto);
  }

  /** Poll ingestion job status by jobId. */
  @Get(':id/status')
  async status(@Param('id') id: string) {
    return this.documents.jobStatus(id);
  }

  /** List ingested documents. */
  @Get()
  async list() {
    return this.documents.list();
  }
}
