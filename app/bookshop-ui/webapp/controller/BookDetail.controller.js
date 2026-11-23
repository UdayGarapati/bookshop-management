sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (Controller, UIComponent, JSONModel, Filter, FilterOperator, MessageBox, MessageToast) {
    "use strict";

    return Controller.extend("bookshop.ui.controller.BookDetail", {
        onInit: function () {
            var oViewModel = new JSONModel({
                quantity: 1,
                expectedDeliveryDate: this._formatExpectedDeliveryDate(new Date())
            });
            this.getView().setModel(oViewModel, "detailView");

            var oRouter = UIComponent.getRouterFor(this);
            oRouter.getRoute("Detail").attachPatternMatched(this._onObjectMatched, this);
        },

        _onObjectMatched: function (oEvent) {
            var oArgs = oEvent.getParameter("arguments") || {};
            var sBookId = oArgs.bookId;
            if (!sBookId) {
                return;
            }

            var oView = this.getView();
            var oViewModel = oView.getModel("detailView");
            oViewModel.setProperty("/quantity", 1);
            oViewModel.setProperty("/expectedDeliveryDate", this._formatExpectedDeliveryDate(new Date()));

            var oCatalogModel = oView.getModel();
            var oListBinding = oCatalogModel.bindList("/Books", null, null, [
                new Filter("ID", FilterOperator.EQ, sBookId)
            ]);

            oView.setBusy(true);
            oListBinding.requestContexts(0, 1).then(function (aContexts) {
                oView.setBusy(false);
                if (aContexts && aContexts.length > 0) {
                    oView.setBindingContext(aContexts[0]);
                } else {
                    oView.setBindingContext(null);
                    MessageToast.show("Book not found.");
                }
            }).catch(function (oError) {
                oView.setBusy(false);
                var sMessage = (oError && oError.message) ? oError.message : "Failed to load book details.";
                MessageBox.error(sMessage);
            });
        },

        _formatExpectedDeliveryDate: function (oBaseDate) {
            var oDate = oBaseDate ? new Date(oBaseDate) : new Date();
            if (isNaN(oDate.getTime())) {
                oDate = new Date();
            }
            oDate.setDate(oDate.getDate() + 7);

            return oDate.toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "2-digit"
            });
        },

        onNavBack: function () {
            UIComponent.getRouterFor(this).navTo("Dashboard");
        },

        onPlaceOrder: function () {
            var oView = this.getView();
            var oBookContext = oView.getBindingContext();
            if (!oBookContext) {
                MessageToast.show("Book details not loaded yet.");
                return;
            }

            var oBook = oBookContext.getObject() || {};
            var oViewModel = oView.getModel("detailView");
            var iQuantity = parseInt(oViewModel.getProperty("/quantity"), 10) || 1;
            var iStock = parseInt(oBook.stock, 10) || 0;

            if (iStock <= 0 || iQuantity > iStock) {
                MessageBox.warning("Insufficient stock available for this order.");
                return;
            }

            var oOrderDate = new Date();
            var sExpectedDelivery = this._formatExpectedDeliveryDate(oOrderDate);
            oViewModel.setProperty("/expectedDeliveryDate", sExpectedDelivery);

            var fUnitPrice = parseFloat(oBook.price) || 0;
            var sTotalPrice = (fUnitPrice * iQuantity).toFixed(2);
            var sCurrency = oBook.currency_code || "EUR";

            var oOrderModel = oView.getModel("order");
            var oListBinding = oOrderModel.bindList("/Orders");

            var oCreatedContext = oListBinding.create({
                currency: sCurrency,
                totalPrice: sTotalPrice,
                items: [
                    {
                        book_ID: oBook.ID,
                        quantity: iQuantity,
                        netAmount: sTotalPrice
                    }
                ]
            });

            oView.setBusy(true);
            oCreatedContext.created().then(function () {
                var sOrderNumber = oCreatedContext.getProperty("orderNumber") || "Confirmed";
                oViewModel.setProperty("/quantity", 1);

                return Promise.resolve(oBookContext.refresh()).then(function () {
                    oView.setBusy(false);
                    MessageBox.success(
                        "Order " + sOrderNumber + " placed successfully!\n\n" +
                        "Book: " + oBook.title + "\n" +
                        "Quantity: " + iQuantity + "\n" +
                        "Total Amount: " + sTotalPrice + " " + sCurrency + "\n" +
                        "Expected Delivery Date: " + sExpectedDelivery + " (7 days from order date)",
                        {
                            title: "Order Confirmed"
                        }
                    );
                });
            }).catch(function (oError) {
                oView.setBusy(false);
                if (oCreatedContext && oCreatedContext.delete) {
                    oCreatedContext.delete("$auto").catch(function () {
                        // Ignore cleanup error on failed transient context
                    });
                }
                var sMessage = (oError && oError.message) ? oError.message : "Unknown error";
                MessageBox.error("Failed to place order: " + sMessage);
            });
        }
    });
});