export function getInventoryProductIdFromSelection(selectionId: string) {
  const separatorIndex = selectionId.indexOf("::");
  return separatorIndex === -1 ? selectionId : selectionId.slice(0, separatorIndex);
}
