sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (
    Controller,
    UIComponent,
    MessageBox,
    MessageToast
) {
    "use strict";

    return Controller.extend("bookshop.ui.controller.Wishlist", {
        onInit: function () {
            var oRouter = UIComponent.getRouterFor(this);
            var oRoute = oRouter && oRouter.getRoute("Wishlist");
            if (oRoute) {
                oRoute.attachPatternMatched(this._onRouteMatched, this);
            }
        },

        _onRouteMatched: function () {
            var oTable = this.byId("wishlistTable");
            var oBinding = oTable && oTable.getBinding("items");
            if (oBinding && oBinding.refresh) {
                oBinding.refresh();
            }
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

        _getWishlistBookData: function (oEvent) {
            var oSource = oEvent.getSource();
            var oRowCtx = oSource && oSource.getBindingContext("order");
            var oRow = oRowCtx && oRowCtx.getObject();
            var oBook = (oRow && oRow.book) || {};
            var sBookId = oBook.ID || (oRow && oRow.book_ID);

            var iRawStock = (oBook.stock === null || oBook.stock === undefined)
                ? 99
                : parseInt(oBook.stock, 10);

            return {
                bookId: sBookId,
                title: oBook.title || "Selected Book",
                price: parseFloat(oBook.price) || 0,
                stock: isNaN(iRawStock) ? 99 : iRawStock,
                currency: oBook.currency_code || "EUR"
            };
        },

        onAddToCart: function (oEvent) {
            var oView = this.getView();
            var oItemData = this._getWishlistBookData(oEvent);

            if (!oItemData.bookId) {
                MessageToast.show("Book information is not available.");
                return;
            }

            if (oItemData.stock <= 0) {
                MessageBox.warning("This book is currently out of stock.");
                return;
            }

            var oComponent = this.getOwnerComponent();
            var oCartModel = oComponent.getModel("cart");
            var aItems = (oCartModel && oCartModel.getProperty("/items")) || [];
            var oOrderModel = oView.getModel("order") || oView.getModel();

            var oExisting = aItems.find(function (item) {
                return item.book_ID === oItemData.bookId;
            });

            var iTargetQty = oExisting ? (oExisting.quantity + 1) : 1;
            if (iTargetQty > oItemData.stock) {
                MessageBox.warning("Total cart quantity exceeds available stock (" + oItemData.stock + ").");
                return;
            }

            var sNetAmount = (oItemData.price * iTargetQty).toFixed(2);
            oView.setBusy(true);

            if (oExisting && oExisting.cartItemId) {
                oOrderModel.bindList("/CartItems").requestContexts(0, 100).then(function (aCtx) {
                    var oTargetCtx = aCtx.find(function (c) {
                        return c.getProperty("ID") === oExisting.cartItemId;
                    });
                    var pUpdate = oTargetCtx
                        ? Promise.all([
                            oTargetCtx.setProperty("quantity", iTargetQty),
                            oTargetCtx.setProperty("netAmount", sNetAmount)
                        ])
                        : Promise.resolve();

                    return pUpdate.then(function () {
                        return oComponent.loadCartFromBackend ? oComponent.loadCartFromBackend() : Promise.resolve();
                    });
                }).then(function () {
                    oView.setBusy(false);
                    MessageToast.show("Updated \"" + oItemData.title + "\" quantity in cart (" + iTargetQty + ").");
                }).catch(function (oErr) {
                    oView.setBusy(false);
                    MessageBox.error("Failed to update cart item: " + (oErr.message || "Unknown error"));
                });
            } else {
                var oListBinding = oOrderModel.bindList("/CartItems");
                var oCreatedCtx = oListBinding.create({
                    book_ID: oItemData.bookId,
                    quantity: 1,
                    unitPrice: oItemData.price.toFixed(2),
                    netAmount: oItemData.price.toFixed(2),
                    currency: oItemData.currency
                });

                oCreatedCtx.created().then(function () {
                    return oComponent.loadCartFromBackend ? oComponent.loadCartFromBackend() : Promise.resolve();
                }).then(function () {
                    oView.setBusy(false);
                    MessageToast.show("Added \"" + oItemData.title + "\" to cart.");
                }).catch(function (oErr) {
                    oView.setBusy(false);
                    if (oCreatedCtx && oCreatedCtx.delete) {
                        oCreatedCtx.delete("$auto").catch(function () {});
                    }
                    MessageBox.error("Failed to add item to cart: " + (oErr.message || "Unknown error"));
                });
            }
        },

        onPlaceOrder: function (oEvent) {
            var oView = this.getView();
            var oItemData = this._getWishlistBookData(oEvent);

            if (!oItemData.bookId) {
                MessageToast.show("Book information is not available.");
                return;
            }

            if (oItemData.stock <= 0) {
                MessageBox.warning("Insufficient stock available for this order.");
                return;
            }

            var iQty = 1;
            var sNetAmount = (oItemData.price * iQty).toFixed(2);
            var sExpectedDelivery = this._formatExpectedDeliveryDate(new Date());
            var oOrderModel = oView.getModel("order");
            var oListBinding = oOrderModel.bindList("/Orders");

            var oCreatedContext = oListBinding.create({
                currency: oItemData.currency,
                totalPrice: sNetAmount,
                items: [
                    {
                        book_ID: oItemData.bookId,
                        quantity: iQty,
                        netAmount: sNetAmount
                    }
                ]
            });

            oView.setBusy(true);
            oCreatedContext.created().then(function () {
                oView.setBusy(false);
                var sOrderNumber = oCreatedContext.getProperty("orderNumber") || "Confirmed";
                MessageBox.success(
                    "Order " + sOrderNumber + " placed for \"" + oItemData.title + "\" (x" + iQty + ")!\n\n" +
                    "Total Amount: " + sNetAmount + " " + oItemData.currency + "\n" +
                    "Expected Delivery Date: " + sExpectedDelivery + " (7 days from order date)",
                    {
                        title: "Order Confirmed",
                        onClose: function () {
                            UIComponent.getRouterFor(this).navTo("OrderHistory");
                        }.bind(this)
                    }
                );
            }.bind(this)).catch(function (oError) {
                oView.setBusy(false);
                if (oCreatedContext && oCreatedContext.delete) {
                    oCreatedContext.delete("$auto").catch(function () {});
                }
                MessageBox.error("Failed to place order: " + (oError.message || "Unknown error"));
            });
        },

        onNavBack: function () {
            UIComponent.getRouterFor(this).navTo("Dashboard");
        }
    });
});