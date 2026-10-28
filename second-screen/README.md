# Tablet second screen

Use an **iPad** or an **Android** tablet or phone as an extended monitor for a Windows PC. Windows gets a second (virtual) screen, and the tablet shows it. Drag windows onto it like any other monitor.

It works over the same Wi-Fi, or over a USB cable for Android. You don't need to run `npm install`, create an account, or be online. You only need [Node.js](https://nodejs.org) on the PC.

## Setup (once, needs administrator)

Double-click **`setup.cmd`** and accept the administrator prompt. It:

1. Downloads and installs the open-source, signed [Virtual Display Driver](https://github.com/VirtualDrivers/Virtual-Display-Driver), pinned to release 25.7.23 and checked against a SHA-256 hash. The driver comes preset with iPad and Android tablet resolutions.
2. Switches Windows to **Extend these displays**.
3. Lets devices on the same local network reach the PC on port 8080 through Windows Firewall. This also works on networks set to Public.

Optional: in Settings → System → Display, click the new screen and pick your tablet's resolution. For example, 2360×1640 for an iPad Air or 2560×1600 for a Galaxy Tab S. Lower resolutions give bigger text and smoother video.

Everything after setup runs without administrator rights.

## Use

1. Double-click **`start.cmd`**. It starts the server and opens the PC page in Edge.
2. On the PC page, click **Send extra screen to tablet** and pick the virtual display (usually "Screen 2", not your main screen).
3. On the tablet, open the address shown on the PC (`http://192.168…:8080`) in Safari or Chrome and tap **Connect**.
4. The first time, the PC asks **"New device: … Let it see the extra screen?"** Click **Allow**. The PC remembers that device after this.
5. Tap the video on the tablet to make it full screen. Android also switches to landscape.

### Android over USB

No driver is needed: Windows already supports Android USB tethering.

1. Connect the Android device to the PC with a USB cable.
2. On Android, turn on **Settings → Network & internet → Hotspot & tethering → USB tethering**. The menu names vary a little between brands.
3. Start (or restart) `start.cmd`. A new address appears for the USB network. Open it in Chrome on the Android device.

While tethering, Windows may use the phone's mobile data for internet. Turn off mobile data on the phone if you don't want that.

### iPad over USB

This app can't use USB with an iPad. Windows needs Apple's driver (from the Apple Devices app or iTunes), and only iPads with a SIM slot can share a network over USB. Use Wi-Fi instead.

## Uninstall

Run `setup.cmd -Uninstall` from a terminal in this folder. It removes the virtual display, its driver, and the firewall rule.

## Troubleshooting

- **Several addresses are printed:** each one is labeled with its network adapter. Use the one on the same network as the tablet: the Wi-Fi adapter, or for USB the address that only appears after you turn on USB tethering.
- **The tablet can't load the page:** both devices must be on the same network, and `setup.cmd` must have run. Some shared or hotel Wi-Fi networks block devices from talking to each other. Use USB tethering (Android) or a phone hotspot instead.
- **No "Screen 2" in the picker:** restart the PC once after setup, then check Settings → System → Display.
- **Touch input:** the tablet only displays the screen; touches don't control the PC. If you need touch, [spacedesk](https://www.spacedesk.net/) is free and also works over the local network.
- **To forget allowed devices:** on the PC page, clear the site data for `localhost:8080` in the browser.
