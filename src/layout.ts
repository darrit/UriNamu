// Public layout API. Implementation modules import each other directly to avoid cycles.
export {
  type Layout,
  layoutModes,
  type Point,
  type Blocker,
  type Rect,
  type Scene,
} from "./layout/types";
export { personFootprint, personFace, partnerSlotBox } from "./layout/geometry";
export {
  anchorSeparation,
  cardSeparation,
  gapKind,
  blockersAround,
  positionsOverlap,
  freePosition,
  freePair,
} from "./layout/spacing";
export {
  flowingConnector,
  softRoute,
  smoothLink,
  clearLink,
  besideConnection,
  branchMarkerPosition,
  connectionPort,
} from "./layout/routes";
export { arrangeFamily } from "./layout/arrangement";
export { dynastyRegion } from "./layout/dynasties";
export { preserveLayout, layoutFamily } from "./layout/scene";
export { ancestorSlotsFor } from "./layout/ancestors";
export { tidyLayout } from "./layout/tidy";
