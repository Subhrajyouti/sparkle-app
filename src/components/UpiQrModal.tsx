import { QRCodeSVG } from "qrcode.react";
import { X, IndianRupee, Copy, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";

interface OrderItem {
  id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
}

interface UpiQrModalProps {
  open: boolean;
  onClose: () => void;
  orderCode: string | null;
  customerName: string;
  amount: number;
  items: OrderItem[];
}

const UPI_ID = "khushidas1119@okhdfcbank";
const PAYEE_NAME = "Khushi Das";

export function UpiQrModal({ open, onClose, orderCode, customerName, amount, items }: UpiQrModalProps) {
  const [copied, setCopied] = useState(false);
  if (!open) return null;

  // UPI deep link spec — amount pre-filled so customer just confirms
  const txnNote = `Order ${orderCode ? "#" + orderCode.slice(-4) : ""}`.trim();
  const txnRef = (orderCode || Date.now().toString()).replace(/[^a-zA-Z0-9]/g, "").slice(0, 35) || "TXN";
  const upiUrl =
    `upi://pay?pa=${encodeURIComponent(UPI_ID)}` +
    `&pn=${encodeURIComponent(PAYEE_NAME)}` +
    `&am=${amount.toFixed(2)}` +
    `&cu=INR` +
    `&tn=${encodeURIComponent(txnNote)}` +
    `&tr=${encodeURIComponent(txnRef)}`;

  const copyUpi = async () => {
    await navigator.clipboard.writeText(UPI_ID);
    setCopied(true);
    toast.success("UPI ID copied");
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-card w-full max-w-md rounded-t-2xl sm:rounded-2xl p-5 space-y-4 animate-in slide-in-from-bottom max-h-[95vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-heading font-bold text-lg text-foreground">Scan to Pay</h3>
            <p className="text-xs text-muted-foreground">
              Order #{orderCode ? orderCode.slice(-4) : "----"}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* QR */}
        <div className="bg-white rounded-xl p-4 flex flex-col items-center gap-3 border border-border">
          <QRCodeSVG
            value={upiUrl}
            size={220}
            level="M"
            includeMargin={false}
          />
          <div className="text-center">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Amount</p>
            <p className="text-2xl font-heading font-bold text-foreground inline-flex items-center">
              <IndianRupee className="w-5 h-5" />
              {amount.toFixed(2)}
            </p>
          </div>
          <button
            onClick={copyUpi}
            className="flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/5 px-3 py-1.5 rounded-md"
          >
            {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {UPI_ID}
          </button>
        </div>

        {/* Items breakdown */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Items</p>
          <div className="space-y-1 bg-muted/40 rounded-lg p-3">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm text-foreground">
                <span>
                  {item.quantity} × {item.item_name}
                </span>
                <span className="font-medium">₹{(item.quantity * item.unit_price).toFixed(2)}</span>
              </div>
            ))}
            <div className="border-t border-border pt-2 mt-2 flex justify-between font-heading font-bold text-foreground">
              <span>Total</span>
              <span>₹{amount.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-center text-muted-foreground">
          Customer scans with any UPI app · amount is pre-filled
        </p>

        <Button onClick={onClose} variant="outline" className="w-full h-11">
          Close
        </Button>
      </div>
    </div>
  );
}
