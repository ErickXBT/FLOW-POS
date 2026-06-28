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
      const device = await (navigator as any).bluetooth.requestDevice({
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
      const device = await (navigator as any).usb.requestDevice({ filters: [] });
      await device.open();
      await device.selectConfiguration(1);
      await device.claimInterface(0);

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

  generateEscPosBytes(order: any, tenant: any, settings: PrinterSettings): Uint8Array {
    const cols = settings.paperSize === "80mm" ? 48 : 32;
    const encoder = new TextEncoder();
    const parts: Uint8Array[] = [];

    const addBytes = (bytes: Uint8Array) => parts.push(bytes);
    const addText = (text: string) => parts.push(encoder.encode(text + "\n"));

    const marginLeft = settings.marginLeft ? Math.floor(settings.marginLeft / 4) : 0;
    const padMargin = (text: string) => " ".repeat(marginLeft) + text;

    addBytes(CMD_INIT);

    addBytes(CMD_ALIGN_CENTER);
    addBytes(CMD_SIZE_DOUBLE);
    addText((tenant?.name || "Flow POS").toUpperCase());

    addBytes(CMD_SIZE_NORMAL);
    if (tenant?.address) addText(tenant.address);
    if (tenant?.phone) addText(`Telp: ${tenant.phone}`);
    
    addBytes(CMD_ALIGN_LEFT);
    addText("-".repeat(cols));

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

    addBytes(CMD_ALIGN_CENTER);
    addText("Terima kasih atas kunjungan Anda!");
    addText("Selamat menikmati!");
    addText("\n\n\n");

    if (settings.autoCut) {
      addBytes(CMD_CUT);
    }

    const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
    const merged = new Uint8Array(totalLength);
    let offset = 0;
    parts.forEach(p => {
      merged.set(p, offset);
      offset += p.length;
    });

    return merged;
  },

  async print(order: any, tenant: any, settings: PrinterSettings): Promise<void> {
    const { connectionMode } = settings;

    if (connectionMode === "bluetooth") {
      if (!connectedBleCharacteristic) {
        throw new Error("Printer Bluetooth belum tersambung. Sambungkan ulang di Pengaturan Printer.");
      }
      const bytes = this.generateEscPosBytes(order, tenant, settings);
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
      throw new Error("Koneksi Network IP/LAN langsung dari browser memerlukan middleware khusus. Menggunakan mode cetak Browser Print.");
    }

    this.printViaBrowser(order, tenant, settings);
  },

  generateBarcode128Svg(value: string, width = 1.5, height = 50): string {
    if (!value) return "";
    const CODE128_PATTERNS = [
      "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
      "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
      "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
      "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
      "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
      "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
      "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
      "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
      "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
      "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
      "114131", "311141", "411131", "211412", "211214", "211232", "2331112"
    ];

    let sum = 104;
    const codes: number[] = [104];
    for (let i = 0; i < value.length; i++) {
      const charCode = value.charCodeAt(i);
      let val = charCode - 32;
      if (val < 0 || val > 95) val = 0;
      codes.push(val);
      sum += val * (i + 1);
    }
    const checksum = sum % 103;
    codes.push(checksum);
    codes.push(106);

    let pattern = "";
    for (const code of codes) {
      pattern += CODE128_PATTERNS[code];
    }

    let totalModules = 0;
    for (let i = 0; i < pattern.length; i++) {
      totalModules += parseInt(pattern[i]);
    }

    const totalWidth = totalModules * width;
    let rects = "";
    let currentX = 0;
    for (let i = 0; i < pattern.length; i++) {
      const w = parseInt(pattern[i]) * width;
      if (i % 2 === 0) {
        rects += `<rect x="${currentX}" y="0" width="${w}" height="${height}" fill="black" />`;
      }
      currentX += w;
    }

    return `<svg width="${totalWidth}" height="${height}" viewBox="0 0 ${totalWidth} ${height}" style="display: block;">${rects}</svg>`;
  },

  generateBarcodeEscPosBytes(items: Array<{ name: string; barcode: string; price: number; qty: number }>, settings: PrinterSettings): Uint8Array {
    const parts: Uint8Array[] = [];
    const encoder = new TextEncoder();
    const cols = settings.paperSize === "80mm" ? 48 : 32;

    const addBytes = (bytes: Uint8Array) => parts.push(bytes);
    const addText = (text: string) => parts.push(encoder.encode(text + "\n"));

    addBytes(CMD_INIT);

    items.forEach(item => {
      for (let q = 0; q < item.qty; q++) {
        addBytes(CMD_ALIGN_CENTER);
        
        addBytes(CMD_SIZE_NORMAL);
        addText(item.name.toUpperCase());

        addBytes(new Uint8Array([0x1D, 0x68, 65])); // GS h: height 65 dots
        addBytes(new Uint8Array([0x1D, 0x77, 2]));  // GS w: width module 2
        addBytes(new Uint8Array([0x1D, 0x48, 2]));  // GS H: print content text below barcode
        
        const barcodeData = encoder.encode(item.barcode);
        const cmdHeader = new Uint8Array([0x1D, 0x6B, 73, barcodeData.length + 2, 0x7B, 0x42]);
        addBytes(cmdHeader);
        addBytes(barcodeData);

        addText("");
        if (item.price > 0) {
          addText(`Rp ${item.price.toLocaleString("id-ID")}`);
        }
        addText("\n" + "-".repeat(cols) + "\n");
      }
    });

    addBytes(new Uint8Array([0x1B, 0x64, 4]));
    if (settings.autoCut) {
      addBytes(CMD_CUT);
    }

    const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
    const merged = new Uint8Array(totalLength);
    let offset = 0;
    parts.forEach(p => {
      merged.set(p, offset);
      offset += p.length;
    });

    return merged;
  },

  async printBarcodes(items: Array<{ name: string; barcode: string; price: number; qty: number }>, settings: PrinterSettings): Promise<void> {
    const { connectionMode } = settings;

    if (connectionMode === "bluetooth") {
      if (!connectedBleCharacteristic) {
        throw new Error("Printer Bluetooth belum tersambung. Sambungkan ulang di Pengaturan Printer.");
      }
      const bytes = this.generateBarcodeEscPosBytes(items, settings);
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
      const bytes = this.generateBarcodeEscPosBytes(items, settings);
      await connectedUsbDevice.transferOut(connectedUsbEndpoint.endpointNumber, bytes);
      return;
    }

    if (connectionMode === "network") {
      throw new Error("Koneksi Network IP/LAN langsung dari browser memerlukan middleware khusus. Menggunakan mode cetak Browser Print.");
    }

    this.printBarcodesViaBrowser(items, settings);
  },

  printBarcodesViaBrowser(items: Array<{ name: string; barcode: string; price: number; qty: number }>, settings: any): void {
    const cols = settings.columns || 2;
    const barcodeHeight = settings.barcodeHeight || 60;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      throw new Error("Pop-up Terblokir! Harap aktifkan izin pop-up browser.");
    }

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

  printViaBrowser(order: any, tenant: any, settings: PrinterSettings): void {
    const storeName = tenant?.name || "Flow POS Kasir";
    const storeAddress = tenant?.address || "";
    const storePhone = tenant?.phone || "";
    const isFashion = tenant?.businessType === "fashion";

    const paperWidth = settings.paperSize === "58mm" ? "280px" : "380px";
    
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
