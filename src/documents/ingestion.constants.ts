export const INGESTION_QUEUE = 'ingestion';

export interface IngestionJobData {
  documentId: string;
  text?: string;
  sourceUrl?: string;
}
