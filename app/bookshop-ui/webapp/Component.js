sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/model/json/JSONModel",
    "sap/ui/Device"
], function (UIComponent, JSONModel, Device) {
    "use strict";

    return UIComponent.extend("bookshop.ui.Component", {
        metadata: {
            manifest: "json"
        },

        init: function () {
            UIComponent.prototype.init.apply(this, arguments);

            var oDeviceModel = new JSONModel(Device);
            oDeviceModel.setDefaultBindingMode("OneWay");
            this.setModel(oDeviceModel, "device");

            var oCartModel = new JSONModel({
                items: [],
                totalCount: 0,
                totalAmount: "0.00",
                currency: "EUR"
            });
            this.setModel(oCartModel, "cart");

            this.getRouter().initialize();
            this.loadCartFromBackend();
        },

        loadCartFromBackend: function () {
            var oOrderModel = this.getModel("order") || this.getModel();
            if (!oOrderModel || !oOrderModel.bindList) {
                return Promise.resolve();
            }

            var oBinding = oOrderModel.bindList("/CartItems", null, null, null, {
                $expand: "book"
            });

            return oBinding.requestContexts(0, 100).then(function (aContexts) {
                var aItems = aContexts.map(function (oCtx) {
                    var oRow = oCtx.getObject() || {};
                    var oBook = oRow.book || {};
                    var iQty = parseInt(oRow.quantity, 10) || 1;
                    var fUnitPrice = parseFloat(oRow.unitPrice || oBook.price) || 0;
                    var fNet = fUnitPrice * iQty;

                    return {
                        cartItemId: oRow.ID,
                        book_ID: oRow.book_ID || oBook.ID,
                        title: oBook.title || "Book",
                        price: fUnitPrice.toFixed(2),
                        currency: oRow.currency || oBook.currency_code || "EUR",
                        stock: parseInt(oBook.stock, 10) || 99,
                        quantity: iQty,
                        netAmount: fNet.toFixed(2)
                    };
                });

                this.recalculateCartModel(aItems);
            }.bind(this)).catch(function () {
                // Keep current cart state if backend call fails
            });
        },

        recalculateCartModel: function (aItems) {
            var oCartModel = this.getModel("cart");
            var aSafeItems = aItems || [];
            var iTotalCount = 0;
            var fTotalAmount = 0;
            var sCurrency = (aSafeItems[0] && aSafeItems[0].currency) || "EUR";

            aSafeItems.forEach(function (oItem) {
                var iQty = parseInt(oItem.quantity, 10) || 1;
                var fUnit = parseFloat(oItem.price) || 0;
                var fLine = fUnit * iQty;
                oItem.quantity = iQty;
                oItem.netAmount = fLine.toFixed(2);
                iTotalCount += iQty;
                fTotalAmount += fLine;
            });

            oCartModel.setProperty("/items", aSafeItems);
            oCartModel.setProperty("/totalCount", iTotalCount);
            oCartModel.setProperty("/totalAmount", fTotalAmount.toFixed(2));
            oCartModel.setProperty("/currency", sCurrency);
        }
    });
});