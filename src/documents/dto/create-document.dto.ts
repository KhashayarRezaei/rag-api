import { IsOptional, IsString, IsUrl, MinLength } from 'class-validator';

export class CreateDocumentDto {
  @IsString()
  @MinLength(1)
  title!: string;

  /** Raw text to ingest. Provide this or `sourceUrl`. */
  @IsOptional()
  @IsString()
  text?: string;

  /** A URL to fetch and ingest (HTML is stripped to text). */
  @IsOptional()
  @IsUrl()
  sourceUrl?: string;
}
