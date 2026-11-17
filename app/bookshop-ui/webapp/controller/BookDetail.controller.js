sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (Controller, MessageToast, MessageBox) {
    "use strict";

    return Controller.extend("bookshop.ui.controller.BookDetail", {
        onInit: function () {
            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.getRoute("Detail").attachMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function (oEvent) {
            var sBookId = oEvent.getParameter("arguments").bookId;
            if (!sBookId) {
                return;
            }

            var oView = this.getView();
            
            // Bind element directly to the selected book path via OData V4 with explicit key formatting
            oView.bindElement({
                path: "/Books('" + sBookId + "')",
                parameters: {
                    $$groupId: "$auto"
                }
            });
        },

        onNavBack: function () {
            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.navTo("Books");
        },

        onOrderPress: function () {
            var oView = this.getView();
            var oContext = oView.getBindingContext();
            
            if (!oContext) {
                MessageBox.error("No book selected.");
                return;
            }

            var sBookId = oContext.getProperty("ID");
            var fPrice = oContext.getProperty("price") || 0;
            var sCurrency = oContext.getProperty("currency_code") || oContext.getProperty("currency") || "EUR";
            var sBookTitle = oContext.getProperty("title");
            
            var oStepInput = oView.byId("orderStepInput");
            var iQuantity = oStepInput ? oStepInput.getValue() : 1;
            var fTotal = fPrice * iQuantity;

            // Generate a random unique order number
            var sOrderNumber = "ORD-" + Math.floor(100000 + Math.random() * 900000);

            // Access the order model bound to /orders/
            var oDataModel = oView.getModel("order");
            if (!oDataModel) {
                // Fallback to default model if order model isn't explicitly named
                oDataModel = oView.getModel();
            }

            // Create payload for the OrderService using currency_code
            var oOrderData = {
                orderNumber: sOrderNumber,
                totalPrice: fTotal,
                currency_code: sCurrency,
                status: "PLACED",
                items: [
                    {
                        book_ID: sBookId,
                        quantity: iQuantity,
                        netAmount: fTotal
                    }
                ]
            };

            // Submit POST request to OData V4 /orders/Orders
            var oListBinding = oDataModel.bindList("/Orders");
            try {
                oListBinding.create(oOrderData);
                oDataModel.submitBatch("$auto").then(function() {
                    MessageBox.success("Successfully placed order #" + sOrderNumber + " for " + iQuantity + " copy/copies of '" + sBookTitle + "'!");
                }).catch(function(oError) {
                    MessageBox.error("Failed to place order: " + (oError.message || "Unknown error"));
                });
            } catch (err) {
                MessageBox.error("Error submitting order: " + err.message);
            }
        }
    });
});