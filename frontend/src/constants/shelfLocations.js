export const SHELF_COLUMNS = ["A", "B", "C", "D"];
export const SHELF_LEVELS = [1, 2, 3, 4, 5, 6];

export const SHELF_OPTIONS = SHELF_COLUMNS.flatMap((column) =>
  SHELF_LEVELS.map((level) => `${column}${level}`)
);
