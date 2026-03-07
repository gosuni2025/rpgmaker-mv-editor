# Event Editor

The Event Editor edits the conditions, execution content, images, movement settings, and more for events placed on the map.

## Layout

![Event Editor Overview](../images/events/ev-editor-overview.png)

- **Left panel**: Event name, note, NPC image, movement settings, options, trigger conditions
- **Right panel**: Event page list + execution content (command list) for each page

## Inserting Commands

Press the **Add** button in the execution content area to open the command insertion dialog.

![Command Insertion List](../images/events/ev-command-list.png)

Commands are divided into 4 category tabs, and the search box supports initial letter search (e.g., typing `scr` → shows Script).

---

## Key Command Edit Popups

### Show Text

![Show Text](../images/events/ev-show-text.png)

Specify the face image, background type, and position, then enter the message body. Text codes such as `\V[n]` and `\N[n]` can be used.

---

### Show Picture

![Show Picture](../images/events/ev-show-picture.png)

Set the picture number, image file, origin (top-left/center), coordinates, scale, opacity, and blend mode.

#### Shader Effect (EXT)

![Picture Shader Effect](../images/events/ev-picture-shader.png)

Press the **EXT** button to configure additional shader effects. Adjust blur, ripple, color separation, and other effects along with amplitude, frequency, speed, and direction.

---

### Set Movement Route

The Set Movement Route command supports two modes: **Waypoint** and **Classic**.

#### Waypoint Mode

![Move Route Waypoint](../images/events/ev-move-route.png)

Click directly on the map canvas to set destinations and waypoints to visually configure the route. Red dots (waypoints) and dashed lines indicate the movement path, and the A* algorithm automatically calculates the shortest path avoiding obstacles.

- Press the **Start Editing** button to switch the canvas to waypoint editing mode.
- Click on the map to add waypoints; paths between waypoints are automatically connected.
- Press the **Confirm** button in the right inspector to convert and save the route as movement route commands.

#### Classic Mode

![Move Route Classic](../images/events/ev-move-route-classic.png)

This is the original RPG Maker MV method. Click movement command buttons (up/down/left/right, jump, speed change, etc.) in order to build the route step by step.

---

### Plugin Command

![Plugin Command](../images/events/ev-plugin-cmd.png)

Enter the plugin command name and arguments. Commands from bundled editor plugins can be selected via autocomplete.

---

### Script

#### Script Editor

![Script Editor](../images/events/ev-script-editor.png)

Enter JavaScript code directly. Supports code highlighting and multi-line editing.

#### Sample Insert (Templates)

![Script Sample Template](../images/events/ev-script-template.png)

Click the **Sample Insert** tab to open a list of code snippets by category. Select an item to see a preview on the right, then click **Insert** to add it to the editor.

Categories: Text/Message, Variables/Switches, Movement/Position, Character control, Pictures, Screen effects, Audio, etc.

---

### Conditional Branch — Script Tab

Select **Tab 4 → Script** radio in the conditional branch dialog to enter a JavaScript condition directly.

![Conditional Branch Script](../images/events/ev-cond-branch-script.png)

- **Label**: Brief note about the condition (displayed in the command list)
- **Expression**: JavaScript condition returning `true`/`false`

#### Condition Template (`...` button)

![Conditional Branch Template](../images/events/ev-cond-branch-template.png)

Press the **`...`** button to the right of the expression field to open a list of frequently used condition templates. Categories include ConfigManager, gold, variables, switches, party/items, and more.
