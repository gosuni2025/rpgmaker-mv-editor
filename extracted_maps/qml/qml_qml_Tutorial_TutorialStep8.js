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
        "condition": "yesNo,:tutorialYes,:tutorialNo",
        "followWindow": "MainWindow",
        "hint": qsTr("Do you have the project we finished in step 7?"),
        "icon": "eye",
        "option": 1,
        "x": 432,
        "y": 212
    },
    {
        "condition": "action,Open Project,",
        "followWindow": "MainWindow",
        "hint": qsTr("Loading the step 7 project."),
        "icon": "click",
        "label": ":tutorialYes",
        "x": 69,
        "y": 3
    },
    {
        "condition": "action,Project Loaded,",
        "followWindow": "FileDialog",
        "hint": qsTr("Please select the step 7 project. \nProjects are in the Games folder in My Documents."),
        "icon": "eye",
        "x": 400,
        "y": 113
    },
    {
        "condition": "click,:TutorialStart",
        "followWindow": "MainWindow",
        "hint": qsTr("Project loaded."),
        "icon": "eye",
        "option": 1,
        "x": 400,
        "y": 80
    },
    {
        "condition": "click,",
        "followWindow": "MainWindow",
        "hint": qsTr("Now we will load the data required to start this step."),
        "icon": "eye",
        "label": ":tutorialNo",
        "option": 1,
        "x": 400,
        "y": 80
    },
    {
        "condition": "action,New Project,",
        "followWindow": "MainWindow",
        "hint": qsTr("Click New Project."),
        "icon": "click",
        "x": 27,
        "y": 17
    },
    {
        "command": "presetData,step8",
        "condition": "windowState,Copying,open",
        "followWindow": "NewProject",
        "hint": qsTr("Input the project name and game title, then click OK."),
        "icon": "click",
        "x": 337,
        "y": 125
    },
    {
        "condition": "windowState,Copying,close",
        "followWindow": "Copying",
        "hint": qsTr("Please hold on while the project finishes loading."),
        "icon": "wait",
        "x": 0,
        "y": 0
    },
    {
        "condition": "click,:TutorialStart",
        "followWindow": "MainWindow",
        "hint": qsTr("New project created."),
        "icon": "eye",
        "option": 1,
        "x": 400,
        "y": 80
    },
    {
        "condition": "click,",
        "followWindow": "MainWindow",
        "hint": qsTr("Now we will start the tutorial."),
        "icon": "eye",
        "label": ":TutorialStart",
        "option": 1,
        "x": 400,
        "y": 80
    },
    {
        "condition": "click,",
        "followWindow": "MainWindow",
        "hint": qsTr("In this step we will create an inn and an item shop."),
        "icon": "eye",
        "x": -9999,
        "y": -9999
    },
    {
        "condition": "list,2",
        "followWindow": "MapEditTreeBox",
        "hint": qsTr("Click Normal Town."),
        "icon": "click",
        "x": 141,
        "y": 52
    },
    {
        "comment": "◆宿屋の作成：マップの作成",
        "condition": "click,",
        "followWindow": "MainWindow",
        "hint": qsTr("We'll make the inn the red-roofed building to the left of the town entrance."),
        "icon": "eye",
        "x": 777,
        "y": 239
    },
    {
        "condition": "windowState,MapLoader,open",
        "followWindow": "MapEditTreeBox",
        "hint": qsTr("As in Step 1, we'll use a sample map for the interior map of the inn. \nRight click Normal Town and select \"Load...\"."),
        "icon": "rightClick",
        "x": 165,
        "y": 49
    },
    {
        "condition": "list,40",
        "followWindow": "MapLoader",
        "hint": qsTr("Scroll a bit down the list to find and click \"Inn 1F\"."),
        "icon": "click",
        "x": 149,
        "y": 0
    },
    {
        "condition": "windowState,MapLoader,close",
        "followWindow": "MapLoader",
        "hint": qsTr("Click OK."),
        "icon": "click",
        "x": 527,
        "y": 468
    },
    {
        "condition": "click,",
        "followWindow": "MapEditTreeBox",
        "hint": qsTr("Now a map has been created a level under \"Normal Town\". \nYou can created a layered map structure like this."),
        "icon": "eye",
        "x": 120,
        "y": 68
    },
    {
        "condition": "windowState,QuickBase,open",
        "followWindow": "MainWindow",
        "hint": qsTr("Next let's connect the maps. \nRight click the inn's entrance (10,19)\nand select Quick Event Creation > Transfer."),
        "icon": "rightClick",
        "x": 792,
        "y": 750
    },
    {
        "condition": "windowState,Location,open",
        "followWindow": "QuickBase",
        "hint": qsTr("Click and edit the location."),
        "icon": "click",
        "label": ":ExitLoop",
        "x": 132,
        "y": 45
    },
    {
        "condition": "list,2",
        "followWindow": "Location",
        "hint": qsTr("Click Normal Town."),
        "icon": "click",
        "x": 174,
        "y": 58
    },
    {
        "condition": "mouseEvent,Map,click",
        "followWindow": "Location",
        "hint": qsTr("Click just in front of the entrance to the red building on the lower left."),
        "icon": "click",
        "x": 543,
        "y": 406
    },
    {
        "condition": "windowState,Location,close",
        "followWindow": "Location",
        "hint": qsTr("Click OK and set the location."),
        "icon": "click",
        "x": 966,
        "y": 667
    },
    {
        "condition": "yesNo,:ExitSuccess,:ExitFailure",
        "followWindow": "QuickBase",
        "hint": qsTr("Is the location set to Normal Town (10,30)?"),
        "icon": "eye",
        "x": 117,
        "y": 38
    },
    {
        "condition": "click,:ExitLoop",
        "followWindow": "QuickBase",
        "hint": qsTr("Then let's redo the location settings."),
        "icon": "eye",
        "label": ":ExitFailure",
        "x": 111,
        "y": 38
    },
    {
        "condition": "windowState,QuickBase,close",
        "followWindow": "QuickBase",
        "hint": qsTr("Click OK. The event will be created."),
        "icon": "click",
        "label": ":ExitSuccess",
        "x": 225,
        "y": 77
    },
    {
        "condition": "list,2",
        "followWindow": "MapEditTreeBox",
        "hint": qsTr("Next we make the entrance from the town to the inn. \nClick Normal Town."),
        "icon": "click",
        "x": 162,
        "y": 49
    },
    {
        "condition": "click,",
        "followWindow": "MainWindow",
        "hint": qsTr("Find the coordinates (10,29), the entrance to the inn building."),
        "icon": "click",
        "x": 408,
        "y": 506
    },
    {
        "condition": "windowState,QuickBase,open",
        "followWindow": "MainWindow",
        "hint": qsTr("Right click (10,29),\nand select Quick Event Creation > Door."),
        "icon": "rightClick",
        "x": 411,
        "y": 515
    },
    {
        "condition": "windowState,Location,open",
        "followWindow": "QuickBase",
        "hint": qsTr("Let's set the location. Click."),
        "icon": "click",
        "x": 208,
        "y": 44
    },
    {
        "condition": "list,3",
        "followWindow": "Location",
        "hint": qsTr("Click Inn 1F."),
        "icon": "click",
        "x": 150,
        "y": 57
    },
    {
        "condition": "mouseEvent,Map,click",
        "followWindow": "Location",
        "hint": qsTr("Click the inn entrance."),
        "icon": "click",
        "x": 546,
        "y": 477
    },
    {
        "condition": "windowState,Location,close",
        "followWindow": "Location",
        "hint": qsTr("Click OK and set the location."),
        "icon": "click",
        "x": 957,
        "y": 678
    },
    {
        "condition": "windowState,QuickBase,close",
        "followWindow": "QuickBase",
        "hint": qsTr("Make sure the location is (10,19) or beside it and click OK."),
        "icon": "click",
        "x": 175,
        "y": 167
    },
    {
        "comment": "◆宿屋の作成：看板の作成",
        "condition": "list,1",
        "followWindow": "MapEditTreeBox",
        "hint": qsTr("Now the town and inn are linked. \nNext is creating the inn sign. \nClick tileset B."),
        "icon": "click",
        "x": 66,
        "y": -25
    },
    {
        "condition": "click,",
        "followWindow": "MainWindow",
        "hint": qsTr("Click the inn sign that says \"INN\". \nIt's second from the right in the top row of the tile palette. "),
        "icon": "click",
        "x": 210,
        "y": 66
    },
    {
        "condition": "action,Map,close",
        "followWindow": "MainWindow",
        "hint": qsTr("We'll switch to map mode."),
        "icon": "click",
        "x": 333,
        "y": 20
    },
    {
        "condition": "mouseEvent,Map,click",
        "followWindow": "MainWindow",
        "hint": qsTr("Click above the inn door and place the sign."),
        "icon": "click",
        "x": 411,
        "y": 497
    },
    {
        "condition": "action,Event,click",
        "followWindow": "MainWindow",
        "hint": qsTr("Back to event mode."),
        "icon": "click",
        "x": 381,
        "y": 26
    },
    {
        "comment": "◆宿屋の作成：宿屋イベントの作成",
        "condition": "list,3",
        "followWindow": "MapEditTreeBox",
        "hint": qsTr("Next up is the event in the inn. Click Inn 1F."),
        "icon": "click",
        "x": 171,
        "y": 73
    },
    {
        "condition": "click,",
        "followWindow": "MainWindow",
        "hint": qsTr("First we'll make an inn event. \nLook for the counter to the right of the entrance (11,10)."),
        "icon": "click",
        "x": 708,
        "y": 314
    },
    {
        "condition": "windowState,QuickBase,open",
        "followWindow": "MainWindow",
        "hint": qsTr("Right click on (11,10)\nand select\nQuick Event Creation > Inn."),
        "icon": "rightClick",
        "x": 723,
        "y": 308
    },
    {
        "condition": "windowState,QuickBase,close",
        "followWindow": "QuickBase",
        "hint": qsTr("This time we won't change the image or price. \nClick OK and it will be set."),
        "icon": "click",
        "x": 63,
        "y": 164
    },
    {
        "condition": "click,",
        "followWindow": "MainWindow",
        "hint": qsTr("Now the inn event is complete. \nNext is the item shop."),
        "icon": "eye",
        "x": -9999,
        "y": -9999
    },
    {
        "comment": "◆道具屋の作成：イベント設置",
        "condition": "click,",
        "followWindow": "MainWindow",
        "hint": qsTr("For this, we'll make a traveling merchant staying at the inn into an item shop."),
        "icon": "eye",
        "x": -9999,
        "y": -9999
    },
    {
        "condition": "click,",
        "followWindow": "MainWindow",
        "hint": qsTr("We'll make the merchant's coordinates in the guest room (7,7). \nClick to find those coordinates."),
        "icon": "click",
        "x": 516,
        "y": 158
    },
    {
        "condition": "windowState,EventEditorMain,open",
        "followWindow": "MainWindow",
        "hint": qsTr("Double click the chair above the table, coordinates (7,7)."),
        "icon": "doubleClick",
        "x": 516,
        "y": 158
    },
    {
        "condition": "click,",
        "followWindow": "EventEditorMain",
        "hint": qsTr("Name the event TravelingMerchant."),
        "icon": "keyboard",
        "x": 87,
        "y": 44
    },
    {
        "condition": "windowState,ImageSelector,open",
        "followWindow": "EventEditorMain",
        "hint": qsTr("Double click Image."),
        "icon": "click",
        "x": 66,
        "y": 416
    },
    {
        "condition": "list,12",
        "followWindow": "ImageSelector",
        "hint": qsTr("Let's pick someone who looks like a merchant. \nClick People3."),
        "icon": "click",
        "x": 119,
        "y": 264
    },
    {
        "condition": "list,49",
        "followWindow": "ImageSelector",
        "hint": qsTr("Pick the man facing downward furthest to the left in the bottom row."),
        "icon": "click",
        "x": 272,
        "y": 174
    },
    {
        "condition": "windowState,ImageSelector,close",
        "followWindow": "ImageSelector",
        "hint": qsTr("Click OK and set the image."),
        "icon": "click",
        "x": 548,
        "y": 429
    },
    {
        "comment": "◆道具屋の作成：実行内容の設定",
        "condition": "windowState,EventCommandSelect,open",
        "followWindow": "EventEditorMain",
        "hint": qsTr("For the event content, we're going to set it so that you can shop after he greets you. \nDouble click the first line in \"Contents\"."),
        "icon": "doubleClick",
        "x": 606,
        "y": 131
    },
    {
        "condition": "windowState,EventCommand,open",
        "followWindow": "EventCommandSelect",
        "hint": qsTr("Click \"Show Text...\"."),
        "icon": "click",
        "x": 156,
        "y": 73
    },
    {
        "condition": "click,",
        "followWindow": "EventCommand",
        "hint": qsTr("Enter: \"I'm a traveling merchant. \nPlease buy something.\""),
        "icon": "keyboard",
        "x": 299,
        "y": 44
    },
    {
        "condition": "windowState,EventCommand,close",
        "followWindow": "EventCommand",
        "hint": qsTr("Click OK to set the text."),
        "icon": "click",
        "x": 413,
        "y": 212
    },
    {
        "condition": "windowState,EventCommandSelect,open",
        "followWindow": "EventEditorMain",
        "hint": qsTr("Double click the next line."),
        "icon": "doubleClick",
        "x": 558,
        "y": 183
    },
    {
        "condition": "list,2",
        "followWindow": "EventCommandSelect",
        "hint": qsTr("Click the page 3 tab."),
        "icon": "click",
        "x": 102,
        "y": 28
    },
    {
        "condition": "windowState,EventCommand,open",
        "followWindow": "EventCommandSelect",
        "hint": qsTr("Click \"Shop Processing\"."),
        "icon": "click",
        "x": 153,
        "y": 103
    },
    {
        "condition": "windowState,Merchandise,open",
        "followWindow": "EventCommand",
        "hint": qsTr("We're going to add merchandise for sale to this list. \nDouble click the first line. \nThe merchandise selection window will appear."),
        "icon": "doubleClick",
        "x": 101,
        "y": 39
    },
    {
        "condition": "windowState,Merchandise,close",
        "followWindow": "Merchandise",
        "hint": qsTr("Check that \"Item\" is checked and set to \"Potion\"\nand click OK."),
        "icon": "click",
        "x": 154,
        "y": 245
    },
    {
        "condition": "windowState,Merchandise,open",
        "followWindow": "EventCommand",
        "hint": qsTr("Double click the next line."),
        "icon": "doubleClick",
        "x": 80,
        "y": 59
    },
    {
        "condition": "click,",
        "followWindow": "Merchandise",
        "hint": qsTr("We'll make the second item Magic Water."),
        "icon": "click",
        "x": 145,
        "y": 43
    },
    {
        "condition": "windowState,Merchandise,close",
        "followWindow": "Merchandise",
        "hint": qsTr("Click OK and it will be set."),
        "icon": "click",
        "x": 154,
        "y": 247
    },
    {
        "condition": "windowState,Merchandise,open",
        "followWindow": "EventCommand",
        "hint": qsTr("Double click the next line."),
        "icon": "doubleClick",
        "x": 116,
        "y": 80
    },
    {
        "condition": "click,",
        "followWindow": "Merchandise",
        "hint": qsTr("We'll make the third item Dispel Herb."),
        "icon": "click",
        "x": 151,
        "y": 43
    },
    {
        "condition": "windowState,Merchandise,close",
        "followWindow": "Merchandise",
        "hint": qsTr("Click OK and it will be set."),
        "icon": "click",
        "x": 154,
        "y": 247
    },
    {
        "condition": "windowState,Merchandise,open",
        "followWindow": "EventCommand",
        "hint": qsTr("Double click the next line."),
        "icon": "click",
        "x": 89,
        "y": 98
    },
    {
        "condition": "click,",
        "followWindow": "Merchandise",
        "hint": qsTr("We'll make the 4th item Stimulant."),
        "icon": "click",
        "x": 169,
        "y": 40
    },
    {
        "condition": "windowState,Merchandise,close",
        "followWindow": "Merchandise",
        "hint": qsTr("Click OK and set the items."),
        "icon": "click",
        "x": 154,
        "y": 247
    },
    {
        "condition": "windowState,EventCommand,close",
        "followWindow": "EventCommand",
        "hint": qsTr("We're done adding goods to sell. \nClick OK and it will be set."),
        "icon": "click",
        "x": 107,
        "y": 293
    },
    {
        "condition": "click,",
        "followWindow": "EventEditorMain",
        "hint": qsTr("The items and equipment you can select here for the shop\nare registered in a \"database\", which will be explained later."),
        "icon": "eye",
        "x": 591,
        "y": 179
    },
    {
        "condition": "click,",
        "followWindow": "EventEditorMain",
        "hint": qsTr("The price is also determined by the database\nand when the player sells items, they will be bought for half their value. \nIf the price is zero, the merchant will not buy the item."),
        "icon": "eye",
        "x": 591,
        "y": 179
    },
    {
        "condition": "click,",
        "followWindow": "EventEditorMain",
        "hint": qsTr("That's it for this explanation. We can get back to work."),
        "icon": "eye",
        "x": 591,
        "y": 179
    },
    {
        "condition": "windowState,EventCommandSelect,open",
        "followWindow": "EventEditorMain",
        "hint": qsTr("Lastly, let's make a message for after the player is done shopping. \nDouble click the next line."),
        "icon": "doubleClick",
        "x": 507,
        "y": 260
    },
    {
        "condition": "list,0",
        "followWindow": "EventCommandSelect",
        "hint": qsTr("Click the tab to go to page 1."),
        "icon": "click",
        "x": 27,
        "y": 13
    },
    {
        "condition": "windowState,EventCommand,open",
        "followWindow": "EventCommandSelect",
        "hint": qsTr("Click \"Show Text...\"."),
        "icon": "click",
        "x": 165,
        "y": 82
    },
    {
        "condition": "click,",
        "followWindow": "EventCommand",
        "hint": qsTr("Enter: \"Thank you. \nCome by again sometime.\""),
        "icon": "keyboard",
        "x": 287,
        "y": 35
    },
    {
        "condition": "windowState,EventCommand,close",
        "followWindow": "EventCommand",
        "hint": qsTr("Click OK to set the text."),
        "icon": "click",
        "x": 416,
        "y": 209
    },
    {
        "condition": "windowState,EventEditorMain,close",
        "followWindow": "EventEditorMain",
        "hint": qsTr("Now the traveling merchant event is complete. \nClick OK and it will be set."),
        "icon": "click",
        "x": 792,
        "y": 686
    },
    {
        "comment": "◆テストプレイ",
        "condition": "action,Save Project,close",
        "followWindow": "MainWindow",
        "hint": qsTr("Now our inn and item shop are finished. \nSave the project."),
        "icon": "click",
        "x": 108,
        "y": 20
    },
    {
        "condition": "action,Playtest,close",
        "followWindow": "MainWindow",
        "hint": qsTr("Now let's run a playtest. \nSince your starting gold will be zero, test it out after you get the gold from the chest and grass patch we made in the last step."),
        "icon": "click",
        "x": 1029,
        "y": 23
    },
    {
        "condition": "click,",
        "followWindow": "MainWindow",
        "hint": qsTr("Well done. This is the end of Step 8."),
        "icon": "eye",
        "x": -9999,
        "y": -9999
    }
];
