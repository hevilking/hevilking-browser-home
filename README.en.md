# hevilking's Browser Home

[简体中文](README.md) | **English**

A simple, lightweight, and highly customizable browser start page extension.

## Features

- **Custom backgrounds**: A local image library and online wallpaper sources (Bing daily wallpapers and Picsum), with adjustable blur, brightness, saturation, and other filters.
- **Multiple search engines**: Google, Bing, Baidu, and DuckDuckGo, with search suggestions and history.
- **Shortcut management**: Add, edit, delete, drag to reorder, import, and export shortcuts, with search filtering and duplicate URL detection.
- **Chinese and English interface**: Simplified Chinese by default, with English available in Settings. Translations cover forms, messages, and accessibility labels.
- **Minimal and fast**: Built with plain HTML, CSS, and JavaScript for fast loading.

## Interface language

- Click the gear icon to open **Settings**, then choose **简体中文** or **English** under **General → Language** at the top. The interface uses Simplified Chinese on first use and remembers your saved choice afterward.
- The entire page previews the selected language immediately, without a reload. Click **Save** to keep it; cancelling or closing settings restores the previous language. **Reset defaults** also previews the interface in Chinese.
- Changing the language preserves your search text, cursor position, shortcut names, image file names, and unsaved settings. Language and background preferences are saved together; if saving fails, you can retry or cancel.
- UI text is maintained in `js/i18n/zh-CN.js` and `js/i18n/en.js`. Messages support parameters and plural forms, with missing translations falling back to Chinese.

## Background and appearance

- Click the gear icon to open the settings drawer, organized into background source, auto rotation, appearance, and local library sections. Advanced adjustments are collapsed by default.
- Changes are previewed live and saved only when you click **Save**. Cancelling or closing settings restores the previous values and wallpaper. Clicking outside the drawer does not close it while there are unsaved changes.
- Auto rotation pauses during previews, and adjusting filters keeps the current image. Rotation and image filter controls appear only for image background modes.
- Sliders and numeric inputs stay in sync. Rotation offers preset intervals and a custom interval in seconds; solid colors support hexadecimal values, and gradients offer six presets.
- **Reset defaults** previews the default settings first. Click **Save** to keep them.
- Adding or deleting library images is saved immediately and independently of the settings draft, so cancelling settings does not undo these operations. Images stay on this device, with limits of 8 MB per image, 80 MB in total, and 30 images.

## Switching search engines

- Click the current engine on the left side of the search box to open the dropdown, then click an option to switch immediately. Click outside or click the trigger again to close it.
- Your selected engine is remembered automatically. Switching preserves the search text and cursor selection, then returns focus to the input so you can continue searching.
- The engine menu, search history, and suggestions are shown one at a time. Switching engines refreshes suggestions for the newly selected engine.

## Reordering shortcuts

- Adding and editing shortcuts use the same dark form. You can cancel or click the backdrop to close it. The name field receives focus when the form opens, and focus returns to the original location when it closes.
- Hover over or click the reorder icon at the top right to see mouse instructions in a tooltip. Click it again or click outside to close the tooltip.
- Hold the left mouse button to drag a card, then release to place it. A placeholder shows the drop position as you move. You can drag across rows, drop in empty space after the last card, and scroll automatically near the edges.
- On touchscreens, press and hold for about 250 milliseconds before dragging. Swiping before the long press completes still scrolls the list. After dropping a card, you can use its edit and delete buttons.
- Releasing the mouse outside the list cancels reordering. A temporary status appears beside the heading while you drag. After reordering, a floating **Undo** prompt appears at the bottom of the page for 5 seconds without taking up space in the card layout. Hovering over or focusing **Undo** pauses the dismissal timer.
- Reordering is paused while the shortcut search contains a query, and the tooltip explains why. Click **×** in the search field to clear it. Editing and deleting filtered shortcuts still affect the correct website.

## Installation

### Local installation

1. Clone this repository, or download and extract it locally.
2. Open your browser's extension management page.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the project's root directory.

### Online installation

Install [hevilking's Browser Home](https://microsoftedge.microsoft.com/addons/detail/hdhnemiamgpfghgnlkmkolojlhekmimd) from the extension store.

## License

This project is open source under the [MIT License](LICENSE).
