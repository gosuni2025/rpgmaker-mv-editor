import QtQuick 2.3
import QtQuick.Controls 1.2
import "../BasicControls"
import "../BasicLayouts"
import "../Controls"
import "../Singletons"
import "../Scripts/JsonTemplates.js" as JsonTemplates

MapSelectTreeBox {
    id: root

    property Item mainMenu: null
    property string clipboardFormat: "map"
    property int maxMapId: 999

    readonly property bool projectOpened: DataManager.projectOpened

    dragDrop: true
    contextMenu: mainMenu.mapContextMenu
    findModality: Qt.NonModal

    signal mapRefresh()
    signal updateMenuItems()
    signal mapEdit()
    signal mapNew()
    signal mapLoadX()
    signal mapCopy()
    signal mapPaste()
    signal mapDelete()
    signal mapDeleteYes()
    signal mapShift()
    signal mapGenerateDungeon()
    signal mapSaveAsImage()
    signal executeSaveAsImage(string url)
    signal updateAllAutotiles()

    resources: Item {
        Connections {
            target: mainMenu
            onMapEdit: root.mapEdit()
            onMapNew: root.mapNew()
            onMapLoadX: root.mapLoadX()
            onMapCopy: root.mapCopy()
            onMapPaste: root.mapPaste()
            onMapDelete: root.mapDelete()
            onMapShift: root.mapShift()
            onMapGenerateDungeon: root.mapGenerateDungeon()
            onMapSaveAsImage: root.mapSaveAsImage()
        }

        Binding {
            target: mainMenu
            property: "mapFindNextEnabled"
            value: root.findManager.hasConfig
        }
    }

    children: Item {
        Dialog_MapProperties {
            id: mapProperties
            onOk: root.finishEdit(mapId, dataObject, name)
        }
        Dialog_MapLoader {
            id: mapLoader
            onOk: root.finishLoad(mapId, dataObject, name)
        }
        Dialog_MapShift {
            id: mapShiftDialog
            onOk: mapRefresh()
        }
        Dialog_GenerateDungeon {
            id: generateDungeonDialog
            onOk: {
                mapRefresh();
                updateAllAutotiles();
            }
        }
        Dialog_MapSaveAsImage {
            id: mapSaveAsImageDialog
            onOk: executeSaveAsImage(mapImageUrl)
        }
        MessageBox {
            id: warningBox
            iconType: "warning"
        }
        MessageBox {
            id: deletionQuestionBox
            iconType: "question"
            useYesNo: true
            onYes: root.mapDeleteYes()
        }
    }

    onActiveFocusChanged: {
        updateMenuItems();
    }

    onMapLoad: {
        updateMenuItems();
    }

    onProjectOpenedChanged: {
        updateMenuItems();
    }

    onRefresh: {
        select(DataManager.currentMapId);
    }

    onCurrentIdChanged: {
        DataManager.currentMapId = currentId;
    }

    onExpanded: {
        var info = DataManager.mapInfos[id];
        if (info) {
            info.expanded = true;
        }
    }

    onCollapsed: {
        var info = DataManager.mapInfos[id];
        if (info) {
            info.expanded = false;
        }
    }

    onMoveBranch: {
        var info = DataManager.mapInfos[sourceId];
        if (info) {
            info.parentId = targetId;
        }
        renumberMapOrder();
        updateMenuItems();
        DataManager.databaseModified = true;
    }

    onUpdateMenuItems: {
        if (projectOpened && activeFocus) {
            var mapId = currentId;
            var map = DataManager.maps[mapId];
            var mapLoaded = !!map;
            var pastable = Clipboard.format === clipboardFormat;
            mainMenu.mapEditEnabled = mapLoaded;
            mainMenu.mapNewEnabled = true;
            mainMenu.mapCopyEnabled = mapLoaded;
            mainMenu.mapPasteEnabled = pastable;
            mainMenu.mapDeleteEnabled = mapLoaded;
            mainMenu.mapFindEnabled = true;
            mainMenu.mapFindManager = root.findManager;
        } else {
            mainMenu.mapEditEnabled = false;
            mainMenu.mapNewEnabled = false;
            mainMenu.mapCopyEnabled = false;
            mainMenu.mapPasteEnabled = false;
            mainMenu.mapDeleteEnabled = false;
            mainMenu.mapFindEnabled = false;
        }
    }

    onMapEdit: {
        var mapId = currentId;
        var map = DataManager.maps[mapId];
        var info = DataManager.mapInfos[mapId];
        if (map) {
            mapProperties.dataObject = cloneMap(map);
            mapProperties.mapId = mapId;
            mapProperties.name = info ? info.name : "";
            mapProperties.open();
        }
    }

    onMapNew: {
        var mapId = getNewMapId();
        if (mapId === 0) {
            showWarning(qsTr("Cannot create any more maps."));
        } else {
            mapProperties.dataObject = JSON.parse(JsonTemplates.Map);
            mapProperties.mapId = mapId;
            mapProperties.name = "MAP" + DataManager.makeIdText(mapId, 3);
            mapProperties.open();
        }
    }

    onMapLoadX: {
        var mapId = getNewMapId();
        if (mapId === 0) {
            showWarning(qsTr("Cannot create any more maps."));
        } else {
            mapLoader.mapId = mapId;
            mapLoader.open();
        }
    }

    onMapCopy: {
        var mapId = currentId;
        var map = DataManager.maps[mapId];
        var info = DataManager.mapInfos[mapId];
        var clipData = [map, info];
        Clipboard.setData(clipboardFormat, JSON.stringify(clipData));
        updateMenuItems();
    }

    onMapPaste: {
        var clipData = JSON.parse(Clipboard.getData(clipboardFormat));
        if (clipData) {
            var map = clipData[0];
            var info = clipData[1];
            if (map && info) {
                var mapId = getNewMapId();
                if (mapId === 0) {
                    showWarning(qsTr("Cannot create any more maps."));
                } else {
                    if (info.name.search(/^MAP\d+$/) !== -1) {
                        info.name = "MAP" + DataManager.makeIdText(mapId, 3);
                    }
                    info.parentId = DataManager.currentMapId;
                    DataManager.maps[mapId] = map;
                    DataManager.mapInfos[mapId] = info;
                    DataManager.mapModified[mapId] = true;
                    appendMap(mapId);
                    select(mapId);
                    renumberMapOrder();
                    updateMenuItems();
                }
            }
        }
    }

    onMapDelete: {
        var mapId = currentId;
        var name = DataManager.mapNameOrId(mapId);
        deletionQuestionBox.message = qsTr("Delete %1?").arg(name);
        deletionQuestionBox.open();
    }

    onMapDeleteYes: {
        var mapId = currentId;
        var idList = [mapId].concat(getDescendants(mapId));
        for (var i = 0; i < idList.length; i++) {
            var mapId2 = idList[i];
            delete DataManager.maps[mapId2];
            DataManager.mapInfos[mapId2] = null;
            DataManager.mapModified[mapId2] = true;
        }
        removeBranch(mapId);
        renumberMapOrder();
        compactMapInfos();
        updateMenuItems();
    }

    onMapShift: {
        mapShiftDialog.mapId = currentId;
        mapShiftDialog.open();
    }

    onMapGenerateDungeon: {
        generateDungeonDialog.mapId = currentId;
        generateDungeonDialog.open();
    }

    onMapSaveAsImage: {
        mapSaveAsImageDialog.mapId = currentId;
        mapSaveAsImageDialog.open();
    }

    function showWarning(message) {
        warningBox.message = message;
        warningBox.open();
    }

    function finishEdit(mapId, map, name) {
        var lastMap = DataManager.maps[mapId];
        var info = DataManager.mapInfos[mapId];
        if (!info) {
            info = JSON.parse(JsonTemplates.MapInfo);
            info.parentId = currentId;
            DataManager.mapInfos[mapId] = info;
        }
        DataManager.maps[mapId] = map;
        DataManager.mapModified[mapId] = true;
        info.name = name;
        if (lastMap) {
            if (map.width !== lastMap.width || map.height !== lastMap.height) {
                resizeMap(lastMap, map);
            }
            mapRefresh();
        } else {
            allocateMapData(map);
        }
        appendMap(mapId);
        changeText(mapId, name);
        select(mapId);
        renumberMapOrder();
        updateMenuItems();
    }

    function finishLoad(mapId, map, name) {
        var info = JSON.parse(JsonTemplates.MapInfo);
        info.parentId = currentId;
        DataManager.mapInfos[mapId] = info;
        DataManager.maps[mapId] = map;
        DataManager.mapModified[mapId] = true;
        info.name = name;
        appendMap(mapId);
        changeText(mapId, name);
        select(mapId);
        renumberMapOrder();
        updateMenuItems();
    }

    function cloneMap(map) {
        var data = map.data;
        var map2;
        map.data = null;
        map2 = DataManager.clone(map);
        map.data = data;
        map2.data = data.slice(0);
        return map2;
    }

    function getNewMapId() {
        for (var i = 1; i <= maxMapId; i++) {
            if (!DataManager.mapInfos[i]) {
                return i;
            }
        }
        return 0;
    }

    function renumberMapOrder() {
        for (var i = 1; i < count; i++) {
            var mapId = getId(i);
            var info = DataManager.mapInfos[mapId];
            info.order = i;
        }
    }

    function compactMapInfos() {
        var mapInfos = DataManager.mapInfos;
        while (mapInfos.length > 1 && !mapInfos[mapInfos.length - 1]) {
            mapInfos.pop();
        }
    }

    function allocateMapData(map) {
        var maxAllLayers = 6;
        var dw = map.width;
        var dh = map.height;
        var length = maxAllLayers * dw * dh;
        map.data = [];
        for (var i = 0; i < length; i++) {
            map.data[i] = 0;
        }
    }

    function resizeMap(srcMap, destMap) {
        var maxAllLayers = 6;
        var sw = srcMap.width;
        var sh = srcMap.height;
        var dw = destMap.width;
        var dh = destMap.height;
        var length = maxAllLayers * dw * dh;
        destMap.data = [];
        for (var i = 0; i < length; i++) {
            destMap.data[i] = 0;
        }
        for (var y = 0; y < dh; y++) {
            for (var x = 0; x < dw; x++) {
                if (x < srcMap.width && y < srcMap.height) {
                    for (var z = 0; z < maxAllLayers; z++) {
                        var si = (z * sh + y) * sw + x;
                        var di = (z * dh + y) * dw + x;
                        destMap.data[di] = srcMap.data[si];
                    }
                }
            }
        }
        for (var j = 0; j < destMap.events.length; j++) {
            var event = destMap.events[j];
            if (event) {
                if (event.x >= dw || event.y >= dh) {
                    destMap.events[j] = null;
                }
            }
        }
    }
}
