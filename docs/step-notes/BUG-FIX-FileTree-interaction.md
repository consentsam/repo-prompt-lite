## BUG FIX - FileTree Interaction Issues

### What

- **Issue:** Users were unable to expand/collapse directories by clicking on the row, and could not select/deselect individual files by clicking on their rows. Checkbox clicks were working, and the main "Name" header checkbox also worked for bulk selection.
- **Cause:** The `onClick` handler for individual rows in the `FileTree` component was not correctly distinguishing between file and directory items to call the appropriate action (`toggleNodeExpand` for directories, `toggleNodeSelection` for files). Additionally, several linter errors were introduced and subsequently fixed during the debugging process, related to property names (`depth` vs `level`, `tokenCount` vs `tokenEstimate`), virtualizer row height management, and string escaping in debug logs. A more significant refactor of the `buildFlattenedTree` function was also performed to eliminate incorrect usage of a non-existent `children` property on `FlattenedFile` objects.
- **Fix:**
    1. Modified the `onClick` handler in the `renderRow` function within `FileTree.tsx`.
        - If the clicked node is a directory, `toggleNodeExpand(node)` is called.
        - If the clicked node is a file, `toggleNodeSelection(node)` is called.
    2. Ensured `e.stopPropagation()` is correctly used on the chevron button (for directories) and within the `TriStateCheckbox` component to prevent event bubbling that could lead to unintended double actions.
    3. Corrected linter errors by:
        - Changing `node.depth` to `node.level`.
        - Changing `node.tokenCount` to `node.tokenEstimate`.
        - Reverting row height styling to use `virtualRow.size` and `virtualRow.start` from `@tanstack/react-virtual`.
        - Fixing incorrect string literal escaping (`\\\'` to `\'`) in `logDebug` calls.
    4. Refactored `buildFlattenedTree` to correctly generate `FlattenedFile` objects without referencing a `children` property, calculating `level` and `parentId` based on relative paths. Replaced instances of `memoizedAllNodes` with the correctly generated `flattenedNodes`.

### Testing

- **Manual Testing:**
    - Verified that clicking on a directory row (not the checkbox or chevron) expands/collapses it.
    - Verified that clicking on the chevron icon of a directory row expands/collapses it.
    - Verified that clicking on a file row (not the checkbox) selects/deselects it.
    - Verified that clicking on the checkbox of any file or directory item correctly toggles its selection state and propagates changes up/down the hierarchy.
    - Verified that the "Name" header checkbox still correctly selects/deselects all visible items.
    - Ensured no new console errors appear during these interactions.
    - Confirmed file sizes and token estimates (if visible) are still displayed correctly.

### Follow-ups

- None directly related to this bug fix. Proceed with the implementation plan. 