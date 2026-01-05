# SkillTree

A visual editor for hierarchical data and notes. It renders YAML as a tree, lets you navigate with the keyboard, and manage node details in a side panel. Designed for browsing and editing structured knowledge, skill maps, and config-like documents.

## What You Can Do

- Visualize YAML as a tree (top-down, left-to-right layout)
- Switch between Tree view and Canvas view
- Add, delete, re-parent, and reorder nodes
- Edit node title, description, tags, fields, and notes
- Style nodes with color and title emphasis (bold/italic)
- Search across titles, tags, descriptions, notes, and fields
- Undo/redo changes
- Auto-save the last project in the browser localStorage

## Layout and Panels

- Left panel: YAML editor
- Center panel: Tree/Canvas view
- Right panel: node details (notes and styling)

## Basic Usage

- Select a node to edit its details on the right
- Use the Tree view for precise hierarchy editing
- Use the Canvas view for free positioning and re-parenting
- Use the bottom search bar to jump between matches
- Use Undo/Redo to rollback changes

## Search

Search supports:
- Title, tags, description, note, fields
- Regular expressions
- Case-sensitive matching

## Notes and Styling

- Add rich notes per node
- Assign background colors via palette or custom color picker
- Apply title emphasis (bold/italic)

## Projects and Autosave

- Open and save projects using `.stree.json`
- Autosave stores the latest project locally in the browser
- Clear autosave from the toolbar if needed

## YAML Modes

- Structured mode: `root` with `children` for classic skill trees
- Universal mode: any YAML file renders as a tree based on nesting
