sap.ui.define([
    "sap/ui/core/mvc/Controller"
], function (Controller) {
    "use strict";

    return Controller.extend("bookshop.ui.controller.OrderHistory", {
        onNavBack: function () {
            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.navTo("Dashboard");
        },
        onOpenTrackingDialog: function (oEvent) {
    var oContext = oEvent.getSource().getBindingContext("order");
    var sOrderNum = oContext.getProperty("orderNumber");
    var sTrackingNo = oContext.getProperty("trackingNumber") || "TRK-987654321 (In Transit)";

    sap.m.MessageBox.information("Tracking Details for " + sOrderNum + "\n\nCarrier: DHL Express\nTracking ID: " + sTrackingNo, {
        title: "Shipment Tracking"
    });
}
    });
});