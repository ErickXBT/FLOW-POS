// Service for printer connectivity: System Print, Web Bluetooth, and Web USB raw printing.
export interface PrinterSettings {
  connectionMode: "browser_print" | "bluetooth" | "usb" | "network";
  deviceName: string;
  ipAddress: string;
  port: string;
  paperSize: "58mm" | "80mm";
  autoPrint: boolean;
  autoCut: boolean;
  fontSize?: number;
  marginLeft?: number;
  marginRight?: number;
  alignment?: "left" | "center";
}

// Module-level connection states persist during the SPA session
let connectedBleDevice: any = null;
let connectedBleCharacteristic: any = null;
let connectedUsbDevice: any = null;
let connectedUsbEndpoint: any = null;

// ESC/POS Command bytes
const ESC = 0x1B;
const GS = 0x1D;
const LF = 0x0A;

const CMD_INIT = new Uint8Array([ESC, 0x40]);
const CMD_ALIGN_LEFT = new Uint8Array([ESC, 0x61, 0]);
const CMD_ALIGN_CENTER = new Uint8Array([ESC, 0x61, 1]);
const CMD_ALIGN_RIGHT = new Uint8Array([ESC, 0x61, 2]);
const CMD_SIZE_NORMAL = new Uint8Array([GS, 0x21, 0x00]);
const CMD_SIZE_DOUBLE = new Uint8Array([GS, 0x21, 0x11]);
const CMD_CUT = new Uint8Array([GS, 0x56, 66, 0]);

function formatRp(val: number) {
  return `Rp ${val.toLocaleString("id-ID")}`;
}

function padLine(leftText: string, rightText: string, cols: number): string {
  const spaceNeeded = cols - leftText.length - rightText.length;
  if (spaceNeeded <= 0) {
    return leftText.slice(0, cols - rightText.length - 1) + " " + rightText;
  }
  return leftText + " ".repeat(spaceNeeded) + rightText;
}

export const PrinterService = {
  // Check browser capability
  isBluetoothSupported(): boolean {
    return typeof navigator !== "undefined" && "bluetooth" in navigator;
  },

  isUsbSupported(): boolean {
    return typeof navigator !== "undefined" && "usb" in navigator;
  },

  // Connection states
  isConnected(): boolean {
    return !!(connectedBleCharacteristic || (connectedUsbDevice && connectedUsbEndpoint));
  },

  getConnectedDeviceName(): string {
    if (connectedBleDevice) return connectedBleDevice.name || "Bluetooth Printer";
    if (connectedUsbDevice) return connectedUsbDevice.productName || "USB Printer";
    return "";
  },

  // Connect Web Bluetooth
  async connectBluetooth(): Promise<string> {
    if (!this.isBluetoothSupported()) {
      throw new Error("Web Bluetooth tidak didukung di browser/sistem ini.");
    }

    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          "000018f0-0000-1000-8000-00805f9b34fb", // Standard ESC/POS
          "e7e1a12c-294d-11e5-b939-0800200c9a66", // Xprinter
          "0000ff00-0000-1000-8000-00805f9b34fb", // Generic Serial
        ]
      });

      const server = await device.gatt?.connect();
      if (!server) throw new Error("Gagal menyambungkan ke GATT server.");

      // Attempt to discover serial/printing service
      let service: any = null;
      const targetServices = [
        "000018f0-0000-1000-8000-00805f9b34fb",
        "e7e1a12c-294d-11e5-b939-0800200c9a66",
        "0000ff00-0000-1000-8000-00805f9b34fb"
      ];

      for (const uuid of targetServices) {
        try {
          service = await server.getPrimaryService(uuid);
          if (service) break;
        } catch (e) {}
      }

      if (!service) {
        // Fallback: search all primary services
        const primaryServices = await server.getPrimaryServices();
        if (primaryServices.length > 0) {
          service = primaryServices[0];
        }
      }

      if (!service) {
        throw new Error("Service printer thermal tidak ditemukan di perangkat ini.");
      }

      const characteristics = await service.getCharacteristics();
      const writeChar = characteristics.find((c: any) => c.properties.write || c.properties.writeWithoutResponse);
      if (!writeChar) {
        throw new Error("Karakteristik penulisan (write characteristic) tidak ditemukan.");
      }

      connectedBleDevice = device;
      connectedBleCharacteristic = writeChar;

      // Handle disconnection
      device.addEventListener("gattserverdisconnected", () => {
        connectedBleDevice = null;
        connectedBleCharacteristic = null;
      });

      return device.name || "Bluetooth Printer";
    } catch (err: any) {
      console.error("Bluetooth connection error:", err);
      throw err;
    }
  },

  // Connect Web USB
  async connectUsb(): Promise<string> {
    if (!this.isUsbSupported()) {
      throw new Error("WebUSB tidak didukung di browser/sistem ini.");
    }

    try {
      const device = await navigator.usb.requestDevice({ filters: [] });
      await device.open();
      await device.selectConfiguration(1);
      await device.claimInterface(0);

      // Find OUT bulk endpoint
      let outEp: any = null;
      const iface = device.configuration?.interfaces[0];
      const alternate = iface?.alternates[0];
      if (alternate?.endpoints) {
        for (const ep of alternate.endpoints) {
          if (ep.direction === "out" && ep.type === "bulk") {
            outEp = ep;
            break;
          }
        }
      }

      if (!outEp) {
        throw new Error("Tidak menemukan Bulk OUT endpoint pada printer USB ini.");
      }

      connectedUsbDevice = device;
      connectedUsbEndpoint = outEp;

      return device.productName || "USB Printer";
    } catch (err: any) {
      console.error("USB connection error:", err);
      throw err;
    }
  },

  // Disconnect active devices
  disconnect() {
    if (connectedBleDevice?.gatt?.connected) {
      connectedBleDevice.gatt.disconnect();
    }
    if (connectedUsbDevice) {
      try {
        connectedUsbDevice.close();
      } catch (e) {}
    }
    connectedBleDevice = null;
    connectedBleCharacteristic = null;
    connectedUsbDevice = null;
    connectedUsbEndpoint = null;
  },

  // Encode text and build binary ESC/POS print payload
  generateEscPosBytes(order: any, tenant: any, settings: PrinterSettings): Uint8Array {
    const cols = settings.paperSize === "80mm" ? 48 : 32;
    const encoder = new TextEncoder();
    const parts: Uint8Array[] = [];

    const addBytes = (bytes: Uint8Array) => parts.push(bytes);
    const addText = (text: string) => parts.push(encoder.encode(text + "\n"));

    // Margins logic for POS direct printer (represented as spacer pads)
    const marginLeft = settings.marginLeft ? Math.floor(settings.marginLeft / 4) : 0;
    const padMargin = (text: string) => " ".repeat(marginLeft) + text;

    addBytes(CMD_INIT);

    // Header (Center align)
    addBytes(CMD_ALIGN_CENTER);
    addBytes(CMD_SIZE_DOUBLE);
    addText((tenant?.name || "Flow POS").toUpperCase());

    addBytes(CMD_SIZE_NORMAL);
    if (tenant?.address) addText(tenant.address);
    if (tenant?.phone) addText(`Telp: ${tenant.phone}`);
    
    addBytes(CMD_ALIGN_LEFT);
    addText("-".repeat(cols));

    // Order Meta
    const formattedDate = new Date(order.createdAt || new Date()).toLocaleString("id-ID", {
      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
    });
    addText(padMargin(`No. Struk : ${order.orderNumber || order.id}`));
    addText(padMargin(`Tanggal   : ${formattedDate}`));
    addText(padMargin(`Kasir     : ${order.employeeName || "Kasir Utama"}`));
    addText(padMargin(`Pelanggan : ${order.customerName || "-"}`));
    
    if (order.tableNumber) {
      const tableLabel = tenant?.businessType === "fashion" ? "Fitting Room" : "Meja";
      addText(padMargin(`${tableLabel.padEnd(10, " ")}: ${order.tableNumber}`));
    }
    addText(padMargin(`Pembayaran: ${order.paymentMethod === "cash" ? "Tunai" : order.paymentMethod === "qris" ? "QRIS" : order.paymentMethod === "bank_transfer" ? "Transfer" : "E-Wallet"}`));
    addText("-".repeat(cols));

    // Items
    (order.items || []).forEach((item: any) => {
      const qtyName = `${item.quantity}x ${item.productName || item.name}`;
      const priceStr = formatRp(Number(item.subtotal || item.price * item.quantity));
      addText(padMargin(padLine(qtyName, priceStr, cols - marginLeft)));
      if (item.variantSelection) {
        addText(padMargin(`  Varian: ${item.variantSelection}`));
      }
      if (item.notes) {
        addText(padMargin(`  * "${item.notes}"`));
      }
    });
    addText("-".repeat(cols));

    // Totals
    addText(padMargin(padLine("Subtotal", formatRp(Number(order.subtotal)), cols - marginLeft)));
    if (Number(order.discount) > 0) {
      addText(padMargin(padLine("Diskon", `-${formatRp(Number(order.discount))}`, cols - marginLeft)));
    }
    if (Number(order.serviceCharge) > 0) {
      addText(padMargin(padLine("Biaya Servis", formatRp(Number(order.serviceCharge)), cols - marginLeft)));
    }
    if (Number(order.tax) > 0) {
      addText(padMargin(padLine("Pajak (PB1)", formatRp(Number(order.tax)), cols - marginLeft)));
    }
    addText("-".repeat(cols));

    addBytes(CMD_SIZE_DOUBLE);
    addText(padMargin(padLine("TOTAL", formatRp(Number(order.total)), Math.floor((cols - marginLeft) / 2))));
    
    addBytes(CMD_SIZE_NORMAL);
    addText("-".repeat(cols));

    // Footer
    addBytes(CMD_ALIGN_CENTER);
    addText("Terima kasih atas kunjungan Anda!");
    addText("Selamat menikmati!");
    addText("\n\n\n");

    if (settings.autoCut) {
      addBytes(CMD_CUT);
    }

    // Merge into single array
    const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
    const merged = new Uint8Array(totalLength);
    let offset = 0;
    parts.forEach(p => {
      merged.set(p, offset);
      offset += p.length;
    });

    return merged;
  },

  // Perform active print based on connectionMode settings
  async print(order: any, tenant: any, settings: PrinterSettings): Promise<void> {
    const { connectionMode } = settings;

    if (connectionMode === "bluetooth") {
      if (!connectedBleCharacteristic) {
        throw new Error("Printer Bluetooth belum tersambung. Sambungkan ulang di Pengaturan Printer.");
      }
      const bytes = this.generateEscPosBytes(order, tenant, settings);
      
      // Write in chunks of 20 bytes (standard safe BLE payload size) with a short delay
      const chunkSize = 20;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.slice(i, i + chunkSize);
        await connectedBleCharacteristic.writeValueWithoutResponse(chunk);
        await new Promise(resolve => setTimeout(resolve, 15));
      }
      return;
    }

    if (connectionMode === "usb") {
      if (!connectedUsbDevice || !connectedUsbEndpoint) {
        throw new Error("Printer USB belum tersambung. Sambungkan ulang di Pengaturan Printer.");
      }
      const bytes = this.generateEscPosBytes(order, tenant, settings);
      await connectedUsbDevice.transferOut(connectedUsbEndpoint.endpointNumber, bytes);
      return;
    }

    if (connectionMode === "network") {
      // Direct raw TCP is not possible due to sandbox. Fallback to API server print or browser print.
      throw new Error("Koneksi Network IP/LAN langsung dari browser memerlukan middleware khusus. Menggunakan mode cetak Browser Print.");
    }

    // Default: Browser Print
    this.printBarcodesViaBrowser(items, settings);
  },

  // Render grid of labels for standard office/label sheet printing
  printBarcodesViaBrowser(items: Array<{ name: string; barcode: string; price: number; qty: number }>, settings: any): void {
    const cols = settings.columns || 2;
    const barcodeHeight = settings.barcodeHeight || 60;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      throw new Error("Pop-up Terblokir! Harap aktifkan izin pop-up browser.");
    }

    // Flatten labels based on qty selection
    const labels: Array<{ name: string; barcode: string; price: number }> = [];
    items.forEach(item => {
      for (let i = 0; i < item.qty; i++) {
        labels.push({ name: item.name, barcode: item.barcode, price: item.price });
      }
    });

    const labelsHtml = labels.map(label => {
      const svgMarkup = this.generateBarcode128Svg(label.barcode, 1.5, barcodeHeight);
      return `
        <div class="label-card">
          <div class="product-name">${label.name.toUpperCase()}</div>
          <div class="barcode-svg-container">
            ${svgMarkup}
          </div>
          <div class="barcode-text">${label.barcode}</div>
          ${label.price > 0 ? `<div class="product-price">Rp ${label.price.toLocaleString("id-ID")}</div>` : ""}
        </div>
      `;
    }).join("");

    const htmlContent = `
      <html>
        <head>
          <title>Cetak Barcode</title>
          <style>
            @media print {
              body { margin: 0; padding: 0; }
              @page { margin: 0; }
            }
            body {
              font-family: 'Courier New', Courier, monospace;
              margin: 15px;
              padding: 0;
              box-sizing: border-box;
              background-color: #fff;
            }
            .grid-container {
              display: grid;
              grid-template-columns: repeat(${cols}, 1fr);
              gap: 15px;
            }
            .label-card {
              border: 1px solid #ddd;
              padding: 12px;
              text-align: center;
              border-radius: 8px;
              background: #fff;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              page-break-inside: avoid;
            }
            .product-name {
              font-size: 11px;
              font-weight: bold;
              margin-bottom: 6px;
              word-break: break-all;
              max-height: 24px;
              overflow: hidden;
            }
            .barcode-svg-container {
              margin: 4px 0;
            }
            .barcode-text {
              font-size: 10px;
              font-weight: bold;
              letter-spacing: 2px;
              margin-top: 4px;
            }
            .product-price {
              font-size: 11px;
              font-weight: bold;
              margin-top: 5px;
              border: 1px solid #000;
              padding: 1px 8px;
              border-radius: 4px;
            }
          </style>
        </head>
        <body>
          <div class="grid-container">
            ${labelsHtml}
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  },

  // Print utilizing native browser print window styled with custom margin/padding settings
  printViaBrowser(order: any, tenant: any, settings: PrinterSettings): void {
    const storeName = tenant?.name || "Flow POS Kasir";
    const storeAddress = tenant?.address || "";
    const storePhone = tenant?.phone || "";
    const isFashion = tenant?.businessType === "fashion";

    const paperWidth = settings.paperSize === "58mm" ? "280px" : "380px";
    
    // Apply styling settings
    const fontSize = settings.fontSize || 12;
    const marginLeft = settings.marginLeft || 0;
    const marginRight = settings.marginRight || 0;
    const alignment = settings.alignment || "left";

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      throw new Error("Pop-up Terblokir! Harap aktifkan izin pop-up browser untuk mencetak.");
    }

    const formattedDate = new Date(order.createdAt || new Date()).toLocaleString("id-ID", {
      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
    });

    const itemsHtml = (order.items || []).map((item: any) => `
      <div class="item-row">
        <span>${item.quantity}x ${item.productName || item.name}</span>
        <span>${formatRp(Number(item.subtotal || item.price * item.quantity))}</span>
      </div>
      ${item.variantSelection ? `
      <div class="item-row" style="font-size: 10px; color: #555; margin-top: -2px; margin-bottom: 2px;">
        <span>&nbsp;&nbsp;Varian: ${item.variantSelection}</span>
        <span></span>
      </div>` : ""}
      ${item.notes ? `
      <div class="item-row" style="font-size: 10px; color: #555; margin-top: -2px; margin-bottom: 2px; font-style: italic;">
        <span>&nbsp;&nbsp;"${item.notes}"</span>
        <span></span>
      </div>` : ""}
    `).join("");

    let totalsHtml = `
      <div class="item-row">
        <span>Subtotal</span>
        <span>${formatRp(Number(order.subtotal))}</span>
      </div>
    `;

    if (Number(order.discount) > 0) {
      totalsHtml += `
        <div class="item-row">
          <span>Diskon</span>
          <span>-${formatRp(Number(order.discount))}</span>
        </div>
      `;
    }
    if (Number(order.serviceCharge) > 0) {
      totalsHtml += `
        <div class="item-row">
          <span>Biaya Servis</span>
          <span>${formatRp(Number(order.serviceCharge))}</span>
        </div>
      `;
    }
    if (Number(order.tax) > 0) {
      totalsHtml += `
        <div class="item-row">
          <span>Pajak (PB1)</span>
          <span>${formatRp(Number(order.tax))}</span>
        </div>
      `;
    }

    const htmlContent = `
      <html>
        <head>
          <title>Nota - ${storeName}</title>
          <style>
            @media print {
              body { margin: 0; padding: 0; }
              @page { margin: 0; }
            }
            body {
              font-family: 'Courier New', Courier, monospace;
              width: ${paperWidth};
              font-size: ${fontSize}px;
              color: #000;
              margin: 0 ${alignment === "center" ? "auto" : "0"};
              padding-left: ${marginLeft}px;
              padding-right: ${marginRight}px;
              padding-top: 10px;
              padding-bottom: 10px;
              background-color: #fff;
              box-sizing: border-box;
            }
            .text-center { text-align: center; }
            .divider { border-top: 1px dashed #000; margin: 8px 0; }
            .item-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
            .footer-msg { font-size: ${fontSize - 1}px; margin-top: 15px; }
          </style>
        </head>
        <body>
          <div class="text-center">
            <h3 style="margin: 0 0 4px 0; font-size: ${fontSize + 2}px;">${storeName.toUpperCase()}</h3>
            ${storeAddress ? `<p style="margin: 0 0 2px 0; font-size: ${fontSize - 2}px;">${storeAddress}</p>` : ""}
            ${storePhone ? `<p style="margin: 0 0 8px 0; font-size: ${fontSize - 2}px;">Telp: ${storePhone}</p>` : ""}
          </div>
          <div class="divider"></div>
          <div>
            <p style="margin: 0 0 4px 0;">Nota: ${order.orderNumber || order.id}</p>
            <p style="margin: 0 0 4px 0;">Tanggal: ${formattedDate}</p>
            <p style="margin: 0 0 4px 0;">Tipe: ${
              isFashion
                ? order.orderType === "dine_in" ? "Fitting Room" : order.orderType === "take_away" ? "Ambil di Toko" : "Kirim Kurir"
                : order.orderType === "dine_in" ? "Dine In" : order.orderType === "take_away" ? "Take Away" : "Delivery"
            }</p>
            <p style="margin: 0 0 4px 0;">Pelanggan: ${order.customerName || "-"}</p>
            ${order.orderType === "dine_in" && order.tableNumber ? `<p style="margin: 0 0 4px 0;">${isFashion ? "Fitting Room" : "Meja"}: ${order.tableNumber}</p>` : ""}
            ${order.orderType === "delivery" && order.deliveryAddress ? `<p style="margin: 0 0 4px 0;">Alamat: ${order.deliveryAddress}</p>` : ""}
            <p style="margin: 0 0 4px 0;">Pembayaran: ${order.paymentMethod === "cash" ? "Tunai" : order.paymentMethod === "qris" ? "QRIS" : order.paymentMethod === "bank_transfer" ? "Transfer" : order.paymentMethod === "ewallet" ? "E-Wallet" : order.paymentMethod || "-"}</p>
            ${order.paymentMethod === "cash" ? `
            <p style="margin: 0 0 4px 0;">Uang Diterima: ${formatRp(Number(order.cashReceived || 0))}</p>
            <p style="margin: 0 0 4px 0;">Kembalian: ${formatRp(Math.max(0, Number(order.cashReceived || 0) - Number(order.total)))}</p>
            ` : ""}
            <p style="margin: 0 0 4px 0;">Kasir: ${order.employeeName || "Kasir Utama"}</p>
          </div>
          <div class="divider"></div>
          ${itemsHtml}
          <div class="divider"></div>
          ${totalsHtml}
          <div class="divider"></div>
          <div class="item-row" style="font-weight: bold; font-size: ${fontSize + 2}px;">
            <span>TOTAL</span>
            <span>${formatRp(Number(order.total))}</span>
          </div>
          <div class="divider"></div>
          <div class="text-center footer-msg">
            <p style="margin: 0 0 4px 0;">Terima kasih atas kunjungan Anda!</p>
            <p style="margin: 0 0 8px 0;">Selamat menikmati 🍽️</p>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  }
};
