import { GraphPlanner } from './graph/GraphPlanner.js';

const graphPlanner = new GraphPlanner();

export function generateWorldGraph(options = {}) {
  return graphPlanner.plan(options);
}
