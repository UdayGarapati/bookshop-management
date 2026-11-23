sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageBox"
], function (Controller, MessageBox) {
    "use strict";

    return Controller.extend("bookshop.ui.controller.OrderHistory", {
        onNavBack: function () {
            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.navTo("Dashboard");
        },

        onOpenTrackingDialog: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("order");
            if (!oContext) {
                return;
            }

            var oOrderData = oContext.getObject() || {};
            var sOrderNum = oOrderData.orderNumber || oOrderData.ID || "Unknown Order";
            var sTrackingNo = "TRK-987654321 (In Transit)";
            var sCurrency = oOrderData.currency || "EUR";
            var sTotalPrice = oOrderData.totalPrice != null ? oOrderData.totalPrice + " " + sCurrency : "N/A";

            var aItems = oOrderData.items || [];
            var sItemsSummary = "";

            if (aItems.length > 0) {
                sItemsSummary = aItems.map(function (oItem) {
                    var sBookName = (oItem.book && oItem.book.title) ? oItem.book.title : (oItem.book_ID || "Unknown Book");
                    var iUnits = oItem.quantity != null ? oItem.quantity : 0;
                    return "• " + sBookName + " (Units: " + iUnits + ")";
                }).join("\n");
            } else {
                sItemsSummary = "• No line items recorded for this order";
            }

            var sMessage =
                "Tracking Details for " + sOrderNum + "\n\n" +
                "Carrier: DHL Express\n" +
                "Tracking ID: " + sTrackingNo + "\n\n" +
                "Books Ordered:\n" + sItemsSummary + "\n\n" +
                "Total Amount: " + sTotalPrice;

            MessageBox.information(sMessage, {
                title: "Shipment Tracking"
            });
        }
    });
});