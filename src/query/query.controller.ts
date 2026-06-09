import { Body, Controller, Post } from '@nestjs/common';
import { QueryDto } from './dto/query.dto';
import { QueryResult, QueryService } from './query.service';

@Controller('query')
export class QueryController {
  constructor(private readonly query: QueryService) {}

  /** Ask a question; returns a grounded answer plus the cited source chunks. */
  @Post()
  async ask(@Body() dto: QueryDto): Promise<QueryResult> {
    return this.query.query(dto.question, dto.topK);
  }
}
