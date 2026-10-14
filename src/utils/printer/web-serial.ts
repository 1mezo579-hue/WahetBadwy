/**
 * Web Serial API Driver for Thermal POS Printers & Cash Drawers
 * Enables direct browser-to-hardware communication via USB/Serial COM port.
 */

import { buildCashDrawerKickCommand } from "./escpos";

export interface SerialPrinterStatus {
  isSupported: boolean;
  isConnected: boolean;
  portInfo?: string;
  baudRate: number;
  lastAction?: string;
  lastError?: string;
}

class WebSerialPrinterManager {
  private port: any = null;
  private writer: any = null;
  private baudRate: number = 9600;
  private isConnected: boolean = false;
  private statusListeners: Array<(status: SerialPrinterStatus) => void> = [];

  constructor() {
    if (typeof window !== "undefined" && "serial" in navigator) {
      // Listen for disconnect events
      (navigator as any).serial?.addEventListener("disconnect", () => {
        this.port = null;
        this.writer = null;
        this.isConnected = false;
        this.notifyStatus("تم فصل كابل الطابعة");
      });
    }
  }

  /**
   * Check if the browser supports the Web Serial API
   */
  public isSupported(): boolean {
    return typeof window !== "undefined" && "serial" in navigator;
  }

  /**
   * Request user permission to connect to a thermal printer COM port
   */
  public async connect(baudRate = 9600): Promise<{ success: boolean; error?: string }> {
    if (!this.isSupported()) {
      const err = "متصفحك لا يدعم Web Serial API. يرجى استخدام Google Chrome أو Microsoft Edge على شاشة الكاشير.";
      this.notifyStatus(undefined, err);
      return { success: false, error: err };
    }

    try {
      this.baudRate = baudRate;
      // Request a port from user prompt
      this.port = await (navigator as any).serial.requestPort({
        filters: [], // Accept all USB serial POS printer devices
      });

      // Open connection
      await this.port.open({
        baudRate: this.baudRate,
        dataBits: 8,
        stopBits: 1,
        parity: "none",
        flowControl: "none",
      });

      this.isConnected = true;
      this.notifyStatus("تم ربط الطابعة الحرارية بنجاح عبر منفذ Serial");
      return { success: true };
    } catch (err: any) {
      console.error("Web Serial connection error:", err);
      this.isConnected = false;
      const errorMsg = err.name === "NotFoundError"
        ? "تم إلغاء اختيار المنفذ بواسطة المستخدم"
        : err.message || "فشل الاتصال بالطابعة الحرارية";
      this.notifyStatus(undefined, errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Disconnect active port
   */
  public async disconnect(): Promise<void> {
    try {
      if (this.writer) {
        await this.writer.close();
        this.writer = null;
      }
      if (this.port) {
        await this.port.close();
        this.port = null;
      }
      this.isConnected = false;
      this.notifyStatus("تم إغلاق الاتصال بالطابعة");
    } catch (err) {
      console.error("Error closing serial port:", err);
    }
  }

  /**
   * Send raw byte buffer to printer
   */
  public async sendRaw(data: Uint8Array): Promise<{ success: boolean; error?: string }> {
    if (!this.isConnected || !this.port) {
      return {
        success: false,
        error: "الطابعة غير متصلة عبر Web Serial. يرجى الضغط على زر ربط الطابعة.",
      };
    }

    try {
      if (!this.port.writable) {
        throw new Error("منفذ الطابعة غير قابل للكتابة (Port not writable)");
      }

      const writer = this.port.writable.getWriter();
      await writer.write(data);
      writer.releaseLock();

      this.notifyStatus("تم إرسال أمر الطباعة بنجاح");
      return { success: true };
    } catch (err: any) {
      console.error("Error writing to serial printer:", err);
      const errMsg = err.message || "حدث خطأ أثناء إرسال البيانات للطابعة";
      this.notifyStatus(undefined, errMsg);
      return { success: false, error: errMsg };
    }
  }

  /**
   * CRITICAL REQUIREMENT 2: Cash Drawer Kick
   * Sends the ESC/POS drawer kick pulse to open the drawer
   */
  public async kickDrawer(): Promise<{ success: boolean; error?: string }> {
    const drawerCommand = buildCashDrawerKickCommand();

    if (!this.isConnected || !this.port) {
      console.warn("Hardware serial printer not connected. Simulating cash drawer kick.");
      this.notifyStatus("محاكاة: تم إرسال إشارة فتح درج النقدية 🚪");
      return {
        success: true,
        error: "SIMULATION_MODE",
      };
    }

    const res = await this.sendRaw(drawerCommand);
    if (res.success) {
      this.notifyStatus("🚪 تم فتح درج النقدية بنجاح عبر إشارة ESC/POS");
    }
    return res;
  }

  /**
   * Get current connection status
   */
  public getStatus(): SerialPrinterStatus {
    return {
      isSupported: this.isSupported(),
      isConnected: this.isConnected,
      baudRate: this.baudRate,
      portInfo: this.port?.getInfo ? JSON.stringify(this.port.getInfo()) : undefined,
    };
  }

  /**
   * Subscribe to connection status changes
   */
  public onStatusChange(callback: (status: SerialPrinterStatus) => void): () => void {
    this.statusListeners.push(callback);
    callback(this.getStatus());
    return () => {
      this.statusListeners = this.statusListeners.filter((cb) => cb !== callback);
    };
  }

  private notifyStatus(lastAction?: string, lastError?: string) {
    const status: SerialPrinterStatus = {
      ...this.getStatus(),
      lastAction,
      lastError,
    };
    this.statusListeners.forEach((listener) => listener(status));
  }
}

// Export singleton instance
export const serialPrinter = new WebSerialPrinterManager();
