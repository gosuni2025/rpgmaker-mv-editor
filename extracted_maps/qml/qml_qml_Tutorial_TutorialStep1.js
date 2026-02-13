var scenario = [
    {
        "condition": "click,",
        "followWindow": "MainWindow",
        "hint": qsTr("WARNING: During a tutorial, if you execute a command other than the one the tutorial indicates to, you can go to the %1/%2 to stop the current tutorial and start over.").arg(QT_TRANSLATE_NOOP("MainMenu", "Help")).arg(QT_TRANSLATE_NOOP("MainMenu", "Stop tutorial")),
        "icon": "eye",
        "x": -9999,
        "y": -9999
    },
    {
        "condition": "windowState,NewProject,open",
        "followWindow": "MainWindow",
        "hint": qsTr("Click New Project."),
        "icon": "click",
        "x": 26,
        "y": 22
    },
    {
        "condition": "click,",
        "followWindow": "NewProject",
        "hint": qsTr("Change the title name."),
        "icon": "eye",
        "x": 187,
        "y": 42
    },
    {
        "condition": "windowState,Copying,open",
        "followWindow": "NewProject",
        "hint": qsTr("Click OK."),
        "icon": "click",
        "x": 335,
        "y": 127
    },
    {
        "condition": "windowState,Copying,close",
        "followWindow": "Copying",
        "hint": qsTr("Wait for creating a new project."),
        "icon": "wait",
        "x": 0,
        "y": 0
    },
    {
        "condition": "click,",
        "followWindow": "MainWindow",
        "hint": qsTr("The right side of the screen is the map. \nOn the upper left is the tile palette for the map.\nOn the lower left is the map list."),
        "icon": "eye",
        "option": 1,
        "x": -9999,
        "y": -9999
    },
    {
        "condition": "click,",
        "followWindow": "MainWindow",
        "hint": qsTr("This is the tileset palette. \nSelect a tile here and it will be drawn on the map."),
        "icon": "eye",
        "x": 16,
        "y": 64
    },
    {
        "condition": "windowState,DatabaseMain,open",
        "followWindow": "MainWindow",
        "hint": qsTr("Now for a more detailed explanation on tilesets. \nClick Database."),
        "icon": "click",
        "x": 778,
        "y": 24
    },
    {
        "condition": "list,10",
        "followWindow": "DatabaseMain",
        "hint": qsTr("Here is Tilesets, so click it.").arg(QT_TRANSLATE_NOOP("DatabaseMain", "Tilesets")),
        "icon": "click",
        "x": 56,
        "y": 348
    },
    {
        "condition": "click,",
        "followWindow": "DatabaseMain",
        "hint": qsTr("This is the tileset settings screen. \nThe mode is important. In Field, you can specify the field type\nor area type."),
        "icon": "eye",
        "x": 563,
        "y": 140
    },
    {
        "condition": "windowState,DatabaseMain,close",
        "followWindow": "DatabaseMain",
        "hint": qsTr("Click OK."),
        "icon": "click",
        "x": 912,
        "y": 684
    },
    {
        "condition": "click,",
        "followWindow": "MainWindow",
        "hint": qsTr("In Map Mode, you can draw your map,\nand in Event Mode you can place events."),
        "icon": "eye",
        "option": 1,
        "x": -9999,
        "y": -9999
    },
    {
        "condition": "click,",
        "followWindow": "MainWindow",
        "hint": qsTr("Since we're currently in Event Mode, you can edit events. \nEvents will be further explained later."),
        "icon": "eye",
        "x": 384,
        "y": 29
    },
    {
        "condition": "click,",
        "followWindow": "MainWindow",
        "hint": qsTr("You can zoom in and out on the map. \nGive it a try."),
        "icon": "eye",
        "option": 1,
        "x": 339,
        "y": 32
    },
    {
        "condition": "action,Zoom In,close",
        "followWindow": "MainWindow",
        "hint": qsTr("Click Zoom In to magnify the map."),
        "icon": "click",
        "x": 642,
        "y": 21
    },
    {
        "condition": "action,Zoom Out,close",
        "followWindow": "MainWindow",
        "hint": qsTr("Click Zoom Out to shrink the map."),
        "icon": "click",
        "x": 684,
        "y": 20
    },
    {
        "condition": "click,",
        "followWindow": "MainWindow",
        "hint": qsTr("Pressing <windows>Ctrl</windows><mac>Command</mac> key, roll the center wheel of the mouse to magnify/shrink the map."),
        "icon": "eye",
        "option": 1,
        "x": -9999,
        "y": -9999
    },
    {
        "condition": "click,",
        "followWindow": "MainWindow",
        "hint": qsTr("Pressing the center wheel of the mouse, move the mouse to scroll the map when the entire map is not inside the window."),
        "icon": "eye",
        "option": 1,
        "x": -9999,
        "y": -9999
    },
    {
        "condition": "click,",
        "followWindow": "MainWindow",
        "hint": qsTr("Click Actual Size to rest the map size."),
        "icon": "eye",
        "x": 724,
        "y": 24
    },
    {
        "condition": "click,",
        "followWindow": "MainWindow",
        "hint": qsTr("Now we're done with map zooming. \nNext is an explanation of the map tree on the lower left."),
        "icon": "eye",
        "option": 1,
        "x": -9999,
        "y": -9999
    },
    {
        "condition": "popup,MapPopup",
        "followWindow": "MapEditTreeBox",
        "hint": qsTr("Right-click to change a map name."),
        "icon": "rightClick",
        "x": 53,
        "y": 28
    },
    {
        "condition": "windowState,MapProperties,open",
        "followWindow": "Popup",
        "hint": qsTr("Click Edit..."),
        "icon": "click",
        "x": 28,
        "y": 1
    },
    {
        "condition": "click,",
        "followWindow": "MapProperties",
        "hint": qsTr("Change the name to \"Field Map\"."),
        "icon": "keyboard",
        "x": 192,
        "y": 67
    },
    {
        "condition": "windowState,MapProperties,close",
        "followWindow": "MapProperties",
        "hint": qsTr("Click OK."),
        "icon": "click",
        "x": 685,
        "y": 580
    },
    {
        "condition": "click,",
        "followWindow": "MainWindow",
        "hint": qsTr("Next we will place tiles on the map from the tile palette."),
        "icon": "eye",
        "option": 1,
        "x": -9999,
        "y": -9999
    },
    {
        "condition": "action,Map,open",
        "followWindow": "MainWindow",
        "hint": qsTr("Click Map"),
        "icon": "click",
        "x": 340,
        "y": 19
    },
    {
        "condition": "list,1",
        "followWindow": "MapEditTreeBox",
        "hint": qsTr("Click tileset B."),
        "icon": "click",
        "x": 63,
        "y": -20
    },
    {
        "condition": "pressed,0,0",
        "followWindow": "MainWindow",
        "hint": qsTr("Click a town tile."),
        "icon": "click",
        "x": 208,
        "y": 287
    },
    {
        "condition": "mouseEvent,Map,click",
        "followWindow": "MainWindow",
        "hint": qsTr("Click to put a town."),
        "icon": "click",
        "x": 794,
        "y": 358
    },
    {
        "condition": "pressed,0,0",
        "followWindow": "MainWindow",
        "hint": qsTr("Click a cave tile."),
        "icon": "click",
        "x": 18,
        "y": 127
    },
    {
        "condition": "mouseEvent,Map,click",
        "followWindow": "MainWindow",
        "hint": qsTr("Click to put a cave."),
        "icon": "click",
        "x": 882,
        "y": 358
    },
    {
        "condition": "click,",
        "followWindow": "MapEditTreeBox",
        "hint": qsTr("Next we will create town and cave maps. \nThis time we'll use a sample map."),
        "icon": "eye",
        "x": 168,
        "y": 9
    },
    {
        "condition": "popup,MapPopup",
        "followWindow": "MapEditTreeBox",
        "hint": qsTr("Right-click to load a town map."),
        "icon": "rightClick",
        "x": 83,
        "y": 9
    },
    {
        "condition": "windowState,MapLoader,open",
        "followWindow": "Popup",
        "hint": qsTr("Click Load."),
        "icon": "click",
        "x": 13,
        "y": 2
    },
    {
        "condition": "list,-1",
        "followWindow": "MapLoader",
        "hint": qsTr("Click \"Normal Town\"."),
        "icon": "click",
        "x": 218,
        "y": 122
    },
    {
        "condition": "windowState,MapLoader,close",
        "followWindow": "MapLoader",
        "hint": qsTr("Click OK."),
        "icon": "click",
        "x": 533,
        "y": 470
    },
    {
        "condition": "popup,MapPopup",
        "followWindow": "MapEditTreeBox",
        "hint": qsTr("Right-click to load a cave map."),
        "icon": "rightClick",
        "x": 54,
        "y": 10
    },
    {
        "condition": "windowState,MapLoader,open",
        "followWindow": "Popup",
        "hint": qsTr("Click Load."),
        "icon": "click",
        "x": 13,
        "y": 2
    },
    {
        "condition": "list,-1",
        "followWindow": "MapLoader",
        "hint": qsTr("Click \"Stone Cave\"."),
        "icon": "click",
        "x": 218,
        "y": 227
    },
    {
        "condition": "windowState,MapLoader,close",
        "followWindow": "MapLoader",
        "hint": qsTr("Click OK."),
        "icon": "click",
        "x": 533,
        "y": 470
    },
    {
        "condition": "click,",
        "followWindow": "MainWindow",
        "hint": qsTr("Next we'll link each map to the field using events\nso they can be entered and exited freely."),
        "icon": "eye",
        "option": 1,
        "x": -9999,
        "y": -9999
    },
    {
        "condition": "list,1",
        "followWindow": "MapEditTreeBox",
        "hint": qsTr("Click Map to edit the field map."),
        "icon": "click",
        "x": 61,
        "y": 31
    },
    {
        "condition": "action,Event,close",
        "followWindow": "MainWindow",
        "hint": qsTr("Click Event."),
        "icon": "click",
        "x": 380,
        "y": 20
    },
    {
        "condition": "popup,MapPopup",
        "followWindow": "MainWindow",
        "hint": qsTr("Right-click the town."),
        "icon": "rightClick",
        "x": 783,
        "y": 354
    },
    {
        "condition": "windowState,QuickBase,open",
        "followWindow": "Popup",
        "hint": qsTr("Select Quick Event Creation > Transfer..."),
        "icon": "click",
        "x": 15,
        "y": 10
    },
    {
        "condition": "windowState,Location,open",
        "followWindow": "QuickBase",
        "hint": qsTr("Click Location."),
        "icon": "click",
        "x": 116,
        "y": 40
    },
    {
        "condition": "list,-1",
        "followWindow": "Location",
        "hint": qsTr("Click \"Normal Town\"."),
        "icon": "click",
        "x": 101,
        "y": 58
    },
    {
        "condition": "mouseEvent,Map,click",
        "followWindow": "Location",
        "hint": qsTr("Click the entrance of the town blow."),
        "icon": "click",
        "x": 739,
        "y": 413
    },
    {
        "condition": "windowState,Location,close",
        "followWindow": "Location",
        "hint": qsTr("Click OK."),
        "icon": "click",
        "x": 983,
        "y": 671
    },
    {
        "condition": "windowState,QuickBase,close",
        "followWindow": "QuickBase",
        "hint": qsTr("Click OK."),
        "icon": "click",
        "x": 214,
        "y": 82
    },
    {
        "condition": "list,2",
        "followWindow": "MapEditTreeBox",
        "hint": qsTr("Click \"normal town\" from the map tree."),
        "icon": "click",
        "x": 62,
        "y": 48
    },
    {
        "condition": "popup,MapPopup",
        "followWindow": "MainWindow",
        "hint": qsTr("Right-click at the exit of the town below."),
        "icon": "rightClick",
        "x": 702,
        "y": 404
    },
    {
        "condition": "windowState,QuickBase,open",
        "followWindow": "Popup",
        "hint": qsTr("Select Quick Event Creation > Transfer..."),
        "icon": "click",
        "x": 15,
        "y": 10
    },
    {
        "condition": "windowState,Location,open",
        "followWindow": "QuickBase",
        "hint": qsTr("Click Location."),
        "icon": "click",
        "x": 116,
        "y": 40
    },
    {
        "condition": "list,-1",
        "followWindow": "Location",
        "hint": qsTr("Click \"Field Map\"."),
        "icon": "click",
        "x": 74,
        "y": 41
    },
    {
        "condition": "mouseEvent,Map,click",
        "followWindow": "Location",
        "hint": qsTr("Click the town."),
        "icon": "click",
        "x": 546,
        "y": 163
    },
    {
        "condition": "windowState,Location,close",
        "followWindow": "Location",
        "hint": qsTr("Click OK."),
        "icon": "click",
        "x": 983,
        "y": 671
    },
    {
        "condition": "windowState,QuickBase,close",
        "followWindow": "QuickBase",
        "hint": qsTr("Click OK."),
        "icon": "click",
        "x": 214,
        "y": 82
    },
    {
        "condition": "popup,MapPopup",
        "followWindow": "MainWindow",
        "hint": qsTr("Right-click the created event."),
        "icon": "rightClick",
        "x": 713,
        "y": 423
    },
    {
        "condition": "action,editCopy,close",
        "followWindow": "Popup",
        "hint": qsTr("Click Copy."),
        "icon": "click",
        "x": 32,
        "y": 3
    },
    {
        "condition": "popup,MapPopup",
        "followWindow": "MainWindow",
        "hint": qsTr("Right-click a exit tile of the town to fill the exit."),
        "icon": "rightClick",
        "x": 713,
        "y": 423
    },
    {
        "condition": "action,editPaste,close",
        "followWindow": "Popup",
        "hint": qsTr("Click Paste."),
        "icon": "click",
        "x": 32,
        "y": 3
    },
    {
        "condition": "popup,MapPopup",
        "followWindow": "MainWindow",
        "hint": qsTr("Right-click the remaining exit tile of the map."),
        "icon": "rightClick",
        "x": 713,
        "y": 423
    },
    {
        "condition": "action,editPaste,close",
        "followWindow": "Popup",
        "hint": qsTr("Click Paste."),
        "icon": "click",
        "x": 32,
        "y": 3
    },
    {
        "condition": "list,1",
        "followWindow": "MapEditTreeBox",
        "hint": qsTr("Click \"Field Map\"."),
        "icon": "click",
        "x": 60,
        "y": 31
    },
    {
        "condition": "popup,MapPopup",
        "followWindow": "MainWindow",
        "hint": qsTr("Right-click the cave."),
        "icon": "rightClick",
        "x": 867,
        "y": 355
    },
    {
        "condition": "windowState,QuickBase,open",
        "followWindow": "Popup",
        "hint": qsTr("Select Quick Event Creation > Transfer..."),
        "icon": "click",
        "x": 15,
        "y": 10
    },
    {
        "condition": "windowState,Location,open",
        "followWindow": "QuickBase",
        "hint": qsTr("Click Location."),
        "icon": "click",
        "x": 116,
        "y": 40
    },
    {
        "condition": "list,-1",
        "followWindow": "Location",
        "hint": qsTr("Click \"Stone Cave\"."),
        "icon": "click",
        "x": 87,
        "y": 70
    },
    {
        "condition": "mouseEvent,Map,click",
        "followWindow": "Location",
        "hint": qsTr("Click the entrance of the cave below."),
        "icon": "click",
        "x": 663,
        "y": 621
    },
    {
        "condition": "windowState,Location,close",
        "followWindow": "Location",
        "hint": qsTr("Click OK."),
        "icon": "click",
        "x": 983,
        "y": 671
    },
    {
        "condition": "windowState,QuickBase,close",
        "followWindow": "QuickBase",
        "hint": qsTr("Click OK."),
        "icon": "click",
        "x": 214,
        "y": 82
    },
    {
        "condition": "list,3",
        "followWindow": "MapEditTreeBox",
        "hint": qsTr("Click \"Stone Cave\"."),
        "icon": "click",
        "x": 64,
        "y": 69
    },
    {
        "condition": "popup,MapPopup",
        "followWindow": "MainWindow",
        "hint": qsTr("Right-click at the exit of the cave below."),
        "icon": "rightClick",
        "x": 720,
        "y": 336
    },
    {
        "condition": "windowState,QuickBase,open",
        "followWindow": "Popup",
        "hint": qsTr("Select Quick Event Creation > Transfer..."),
        "icon": "click",
        "x": 15,
        "y": 10
    },
    {
        "condition": "windowState,Location,open",
        "followWindow": "QuickBase",
        "hint": qsTr("Click Location."),
        "icon": "click",
        "x": 116,
        "y": 40
    },
    {
        "condition": "list,-1",
        "followWindow": "Location",
        "hint": qsTr("Click \"Field Map\"."),
        "icon": "click",
        "x": 74,
        "y": 41
    },
    {
        "condition": "mouseEvent,Map,click",
        "followWindow": "Location",
        "hint": qsTr("Click the cave."),
        "icon": "click",
        "x": 585,
        "y": 168
    },
    {
        "condition": "windowState,Location,close",
        "followWindow": "Location",
        "hint": qsTr("Click OK."),
        "icon": "click",
        "x": 983,
        "y": 671
    },
    {
        "condition": "windowState,QuickBase,close",
        "followWindow": "QuickBase",
        "hint": qsTr("Click OK."),
        "icon": "click",
        "x": 214,
        "y": 82
    },
    {
        "condition": "click,",
        "followWindow": "MainWindow",
        "hint": qsTr("Now we're done placing our transfer events. \nNext we will determine the player's initial position."),
        "icon": "eye",
        "option": 1,
        "x": -9999,
        "y": -9999
    },
    {
        "condition": "list,2",
        "followWindow": "MapEditTreeBox",
        "hint": qsTr("Click \"Normal Town\"."),
        "icon": "click",
        "x": 65,
        "y": 53
    },
    {
        "condition": "popup,MapPopup",
        "followWindow": "MainWindow",
        "hint": qsTr("Right-click a tile on the road."),
        "icon": "rightClick",
        "x": 850,
        "y": 464
    },
    {
        "condition": "action,Set Starting Position Player,open",
        "followWindow": "Popup",
        "hint": qsTr("Select Set Starting Position > Player."),
        "icon": "click",
        "x": 15,
        "y": 10
    },
    {
        "condition": "action,Save Project,open",
        "followWindow": "MainWindow",
        "hint": qsTr("Click Save Project."),
        "icon": "click",
        "x": 104,
        "y": 25
    },
    {
        "condition": "action,Playtest",
        "followWindow": "MainWindow",
        "hint": qsTr("That's it! Click Playtest."),
        "icon": "click",
        "x": 1028,
        "y": 20
    }
];
