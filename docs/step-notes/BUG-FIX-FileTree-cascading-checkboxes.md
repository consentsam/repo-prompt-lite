## BUG FIX - FileTree Cascading Checkboxes

### What

- **Issue:** When a folder's checkbox was toggled, the selection state did not propagate recursively to its children (files and sub-folders), and parent folders did not correctly update their state (checked, unchecked, indeterminate) based on the selection status of their children.
- **Cause:** The `selectionReducer` in `FileTree.tsx` did not implement the logic for cascading updates. Specifically, the `TOGGLE_NODE` action only affected the clicked node, and other actions like `SELECT_ALL` did not correctly update parent directory states to `indeterminate` or `checked` based on their children.
- **Fix:**
    1.  **Added Helper Functions** in `FileTree.tsx`:
        *   `getDirectChildren(nodeId, allNodes)`: Retrieves direct children of a given node.
        *   `getAllDescendants(nodeId, allNodes)`: Recursively retrieves all descendants (children, grandchildren, etc.) of a node, excluding skipped ones for propagation purposes.
        *   `updateParentStatesAfterToggle(startNodeId, draftNodeStates, allNodes, logPrefix)`: Recursively updates the checkbox state of parent nodes. It determines a parent's state (`checked`, `unchecked`, `indeterminate`) based on the collective state of its non-skipped children.
    2.  **Refactored `selectionReducer` Actions**:
        *   **`TOGGLE_NODE`**: 
            - When a node's checkbox is toggled, its new state (`checked` or `unchecked`) is determined.
            - This new state is applied to the node itself.
            - If the node is a directory, the new state is propagated to all its non-skipped descendants using `getAllDescendants`.
            - `updateParentStatesAfterToggle` is then called, starting from the toggled node's parent, to ensure all ancestor directories correctly reflect the change.
        *   **`SET_NODE_STATE`**: Similar propagation logic as `TOGGLE_NODE` was added for consistency if this action is used to change states that require cascading.
        *   **`SELECT_ALL`**: 
            - All non-skipped nodes (files and directories) are set to `checked`. Skipped nodes are set to `unchecked`.
            - The logic inherently makes parent directories `checked` if they contain any non-skipped children, as those children are also set to `checked`.
        *   **`DESELECT_ALL`**: All nodes are set to `unchecked`. This simplifies parent states to `unchecked` automatically.
        *   **`INITIALIZE_STATES`**: After initial states are set (usually all `unchecked`), `updateParentStatesAfterToggle` is called for all unique parent IDs to ensure correct initial indeterminate/checked states if some nodes were pre-selected (though this is less common for initialization).
        *   **`TOGGLE_VISIBLE_NODES`**: After toggling the state of visible file nodes, `updateParentStatesAfterToggle` is called for their respective parent directories to update their states.
    3.  **Contextual `flattenedNodes`**: Ensured that the reducer logic and helper functions consistently use `currentFlattenedNodes` (a snapshot of the `flattenedNodes` from the component's scope) to avoid issues with stale closures.
    4.  **Linter Error Fixes**: Resolved linter errors related to the `selectionReducer`'s return type with Immer and corrected the `useImperativeHandle` hook to expose all required methods (`expandAll`, `collapseAll`, `selectAll`, `deselectAll`).

### Testing

- **Manual Testing:**
    - **Folder Toggle (Downward Propagation)**: Checked/unchecked a folder. Verified all its non-skipped children files and sub-folders recursively adopted the same state.
    - **Child Toggle (Upward Propagation)**: 
        - Checked a file within a folder. Verified the parent folder became `indeterminate` (if other children were unchecked) or `checked` (if all other children were already checked).
        - Unchecked a file that was part of a fully checked folder. Verified the parent folder became `indeterminate`.
        - Checked the last unchecked file in a folder. Verified the parent folder became `checked`.
        - Unchecked the last checked file in an indeterminate folder (where other children were unchecked). Verified the parent folder became `unchecked`.
    - **`Select All`**: Clicked the main "Name" header checkbox (or equivalent select all button). Verified all non-skipped files and folders became `checked`.
    - **`Deselect All`**: With items selected, clicked the main header checkbox (or equivalent deselect all). Verified all files and folders became `unchecked`.
    - **Skipped Items**: Ensured that toggling a parent folder did not change the selection state of a child that was marked `isSkipped`.
    - **Complex Hierarchy**: Tested with multiple levels of nested folders.
    - **No Console Errors**: Monitored the console for errors during all interactions.

### Follow-ups

- None directly related to this bug fix. The checkbox cascade should now be robust. 