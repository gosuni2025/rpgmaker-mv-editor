import QtQuick 2.3
import QtQuick.Controls 1.2
import "../BasicControls"
import "../BasicLayouts"
import "../Controls"
import "../Layouts"
import "../Singletons"

ModalWindow {
    id: root

    title: qsTr("Sample Maps")

    property int mapId      // In & Out
    property var dataObject // Out
    property string name    // Out

    property int lastIndex: 0
    property int lastScroll: 0

    property url iconSource: "../Images/tree-map.png"

    property var mapNames: [
        qsTr("World 1", "Fantasy"),
        qsTr("World 2", "Fantasy"),
        qsTr("World 3", "Fantasy"),
        qsTr("World 4", "Fantasy"),
        qsTr("World 5", "Fantasy"),
        qsTr("Normal Town", "Fantasy"),
        qsTr("Forest Town", "Fantasy"),
        qsTr("Abandoned Town", "Fantasy"),
        qsTr("Snow Town", "Fantasy"),
        qsTr("Floating Temple", "Fantasy"),
        qsTr("Mining City", "Fantasy"),
        qsTr("Market", "Fantasy"),
        qsTr("Fishing Village", "Fantasy"),
        qsTr("Oasis", "Fantasy"),
        qsTr("Slum", "Fantasy"),
        qsTr("Mountain Village", "Fantasy"),
        qsTr("Nomad Camp", "Fantasy"),
        qsTr("Castle", "Fantasy"),
        qsTr("Snow Castle", "Fantasy"),
        qsTr("Demon Castle", "Fantasy"),
        qsTr("Fortress", "Fantasy"),
        qsTr("Snow Fortress", "Fantasy"),
        qsTr("Forest", "Fantasy"),
        qsTr("Ruins", "Fantasy"),
        qsTr("Deserted Meadow", "Fantasy"),
        qsTr("Deserted Desert", "Fantasy"),
        qsTr("Forest of Decay", "Fantasy"),
        qsTr("Lost Forest", "Fantasy"),
        qsTr("Swamp", "Fantasy"),
        qsTr("Seacoast", "Fantasy"),
        qsTr("Waterfall Forest", "Fantasy"),
        qsTr("House 1", "Fantasy"),
        qsTr("House 2", "Fantasy"),
        qsTr("Mansion", "Fantasy"),
        qsTr("Village House 1F", "Fantasy"),
        qsTr("Village House 2F", "Fantasy"),
        qsTr("Abandoned House", "Fantasy"),
        qsTr("Weapon Shop", "Fantasy"),
        qsTr("Armor Shop", "Fantasy"),
        qsTr("Item Shop", "Fantasy"),
        qsTr("Inn 1F", "Fantasy"),
        qsTr("Inn 2F", "Fantasy"),
        qsTr("Castle 1F", "Fantasy"),
        qsTr("Castle 2F", "Fantasy"),
        qsTr("Castle 3F", "Fantasy"),
        qsTr("Demon Castle 1F", "Fantasy"),
        qsTr("Demon Castle 2", "Fantasy"),
        qsTr("Demon Castle 3", "Fantasy"),
        qsTr("Hall of Transference", "Fantasy"),
        qsTr("Tower 1F", "Fantasy"),
        qsTr("Stone Cave", "Fantasy"),
        qsTr("Ice Cave", "Fantasy"),
        qsTr("Cursed Cave", "Fantasy"),
        qsTr("Lava Cave", "Fantasy"),
        qsTr("Small Town", "Cyberpunk"),
        qsTr("Big City", "Cyberpunk"),
        qsTr("Trading City", "Cyberpunk"),
        qsTr("Slum", "Cyberpunk"),
        qsTr("Underground Town", "Cyberpunk"),
        qsTr("Floating City", "Cyberpunk"),
        qsTr("Shop District", "Cyberpunk"),
        qsTr("Downtown", "Cyberpunk"),
        qsTr("Factory", "Cyberpunk"),
        qsTr("Power Plant", "Cyberpunk"),
        qsTr("Military Base", "Cyberpunk"),
        qsTr("Business District", "Cyberpunk"),
        qsTr("School", "Cyberpunk"),
        qsTr("Transport Base", "Cyberpunk"),
        qsTr("Labratory Facility", "Cyberpunk"),
        qsTr("Harbor", "Cyberpunk"),
        qsTr("Abandoned School", "Cyberpunk"),
        qsTr("Past Battlefield", "Cyberpunk"),
        qsTr("Market", "Cyberpunk"),
        qsTr("Ancient Ruins", "Cyberpunk"),
        qsTr("Transport Route", "Cyberpunk"),
        qsTr("Suburbs", "Cyberpunk"),
        qsTr("Park", "Cyberpunk"),
        qsTr("Hospital", "Cyberpunk"),
        qsTr("House 1", "Cyberpunk"),
        qsTr("House 2", "Cyberpunk"),
        qsTr("Big House 1F", "Cyberpunk"),
        qsTr("Big House 2F", "Cyberpunk"),
        qsTr("Weapon Shop", "Cyberpunk"),
        qsTr("Armor Shop", "Cyberpunk"),
        qsTr("Item Shop", "Cyberpunk"),
        qsTr("Hotel 1F", "Cyberpunk"),
        qsTr("Hotel 2F", "Cyberpunk"),
        qsTr("Office 1F", "Cyberpunk"),
        qsTr("Office 2F", "Cyberpunk"),
        qsTr("School Hall", "Cyberpunk"),
        qsTr("School Classroom", "Cyberpunk"),
        qsTr("Run-down House", "Cyberpunk"),
        qsTr("Sewer", "Cyberpunk"),
        qsTr("Factory", "Cyberpunk"),
        qsTr("Computer Room", "Cyberpunk"),
        qsTr("Military Base", "Cyberpunk"),
        qsTr("Garage", "Cyberpunk"),
        qsTr("Lab Room", "Cyberpunk"),
        qsTr("Space Station", "Cyberpunk"),
        qsTr("Ancient Ruins", "Cyberpunk"),
        qsTr("Base Interior", "Cyberpunk"),
        qsTr("Sewer Cave", "Cyberpunk"),
        qsTr("Casino", "Cyberpunk"),
        qsTr("Hospital", "Cyberpunk"),
    ]

    DialogBox {
        applyVisible: false

        property int sampleMapId: listBox.currentIndex + 1

        onOk: {
            root.dataObject = DataManager.loadSampleMap(sampleMapId);
            root.name = mapNames[listBox.currentIndex];
        }

        Component.onDestruction: {
            root.lastScroll = listBox.getScrollPosition();
            root.lastIndex = listBox.currentIndex
        }

        Component.onCompleted: {
            listBox.setScrollPosition(root.lastScroll);
            listBox.currentIndex = root.lastIndex;
        }

        DialogBoxRow {
            Palette { id: pal }

            ListBox {
                id: listBox
                width: 220
                height: 442
                headerVisible: false

                ListBoxColumn { role: "text" }

                model: mapNames

                onDoubleClicked: ok()

                itemDelegate: Row {
                    spacing: 2
                    Item {
                        width: 2
                        height: 2
                    }
                    Image {
                        width: 16
                        height: 16
                        anchors.verticalCenter: parent.verticalCenter
                        source: iconSource
                        visible: source !== ""
                    }
                    Text {
                        height: root.itemHeight
                        text: styleData.value
                        color: styleData.textColor
                        verticalAlignment: Text.AlignVCenter
                        font.family: pal.fixedFont
                        font.pixelSize: pal.fontSize
                    }
                }
            }

            ImageSelectorView {
                width: listBox.height
                height: listBox.height
                source: sampleMapId > 0 ? "qrc:/maps/Map" + ("000" + sampleMapId).slice(-3) + ".png" : ""
            }
        }
    }
}
