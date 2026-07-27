import type { CrmOpportunityBoardRow, CrmPipeline, CrmStage } from './portal-types';

export interface BoardColumn {
  stage: CrmStage;
  rows: CrmOpportunityBoardRow[];
}

export function groupByStage(
  stages: CrmStage[],
  rows: CrmOpportunityBoardRow[],
  pipeline: CrmPipeline,
): BoardColumn[] {
  return stages
    .filter(s => s.pipeline === pipeline)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(stage => ({ stage, rows: rows.filter(r => r.stage_id === stage.id) }));
}

export function sumAmount(rows: CrmOpportunityBoardRow[]): number {
  return rows.reduce((acc, r) => acc + Number(r.amount), 0);
}

export function weightedForecast(rows: CrmOpportunityBoardRow[]): number {
  return rows.reduce((acc, r) => acc + (Number(r.amount) * r.probability) / 100, 0);
}
