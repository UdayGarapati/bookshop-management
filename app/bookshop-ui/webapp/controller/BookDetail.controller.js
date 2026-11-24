sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (
    Controller,
    UIComponent,
    JSONModel,
    MessageBox,
    MessageToast
) {
    "use strict";

    return Controller.extend("bookshop.ui.controller.BookDetail", {
        onInit: function () {
            var oDetailModel = new JSONModel({
                expectedDeliveryText: this._formatExpectedDeliveryDate(new Date())
            });
            this.getView().setModel(oDetailModel, "detail");

            var oRouter = UIComponent.getRouterFor(this);
            var oRoute = oRouter && (oRouter.getRoute("Detail") || oRouter.getRoute("BookDetail"));
            if (oRoute) {
                oRoute.attachPatternMatched(this._onObjectMatched, this);
            }
        },

        _onObjectMatched: function (oEvent) {
            var oArgs = oEvent.getParameter("arguments") || {};
            var sBookId = oArgs.bookId || oArgs.id || oArgs.ID;
            var oView = this.getView();
            var oStepInput = this.byId("quantityStepInput");
            var oHeartBtn = this.byId("wishlistBtn");

            if (oStepInput) {
                oStepInput.setValue(1);
            }
            if (oHeartBtn) {
                oHeartBtn.setIcon("sap-icon://heart-2");
                oHeartBtn.setTooltip("Add to Wishlist");
            }

            oView.getModel("detail").setProperty(
                "/expectedDeliveryText",
                this._formatExpectedDeliveryDate(new Date()) 
            );

            if (sBookId) {
                var sCleanId = String(sBookId).replace(/^'|'$/g, "");
                var sPath = "order>/Books(" + sCleanId + ")";

                oView.bindElement({
                    path: sPath,
                    events: {
                        dataReceived: function (oDataEvent) {
                            var oErr = oDataEvent.getParameter("error");
                            if (oErr) {
                                MessageToast.show("Could not load book details.");
                            }
                            this._syncWishlistHeartState(sCleanId);
                        }.bind(this)
                    }
                });

                this._syncWishlistHeartState(sCleanId);
            }
        },

        _setHeartSavedState: function (bSaved) {
            var oHeartBtn = this.byId("wishlistBtn");
            if (!oHeartBtn) {
                return;
            }
            oHeartBtn.setIcon(bSaved ? "sap-icon://heart" : "sap-icon://heart-2");
            oHeartBtn.setTooltip(bSaved ? "Remove from Wishlist" : "Add to Wishlist");
        },

        _syncWishlistHeartState: function (sBookId) {
            var oView = this.getView();
            var oOrderModel = oView.getModel("order") || this.getOwnerComponent().getModel("order");
            var oHeartBtn = this.byId("wishlistBtn");

            if (!oOrderModel || !oOrderModel.bindList || !sBookId || !oHeartBtn) {
                return;
            }

            oOrderModel.bindList("/Wishlist").requestContexts(0, 100).then(function (aContexts) {
                var bSaved = aContexts.some(function (oCtx) {
                    return oCtx.getProperty("book_ID") === sBookId;
                });
                this._setHeartSavedState(bSaved);
            }.bind(this)).catch(function () {
                // Keep default heart icon if wishlist check fails
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

        _getCurrentBookData: function () {
            var oView = this.getView();
            var oCtx = oView.getBindingContext("order") || oView.getBindingContext();
            var oBook = oCtx && oCtx.getObject();
            var oStepInput = this.byId("quantityStepInput");
            var iQty = oStepInput ? (parseInt(oStepInput.getValue(), 10) || 1) : 1;

            var iRawStock = (!oBook || oBook.stock === null || oBook.stock === undefined)
                ? 99
                : parseInt(oBook.stock, 10);

            return {
                bookId: (oBook && oBook.ID) || null,
                title: (oBook && oBook.title) || "Selected Book",
                price: (oBook && parseFloat(oBook.price)) || 0,
                stock: isNaN(iRawStock) ? 99 : iRawStock,
                currency: (oBook && oBook.currency_code) || "EUR",
                quantity: iQty
            };
        },

        onAddToWishlist: function () {
            var oView = this.getView();
            var oBookData = this._getCurrentBookData();

            if (!oBookData.bookId) {
                MessageToast.show("Book details are not available yet.");
                return;
            }

            var oOrderModel = oView.getModel("order") || this.getOwnerComponent().getModel("order");
            var oWishlistBinding = oOrderModel.bindList("/Wishlist");

            oView.setBusy(true);
            oWishlistBinding.requestContexts(0, 100).then(function (aContexts) {
                var aMatchingContexts = aContexts.filter(function (oCtx) {
                    return oCtx.getProperty("book_ID") === oBookData.bookId;
                });

                // Already on wishlist -> remove all matching entries for this book
                if (aMatchingContexts.length > 0) {
                    return Promise.all(aMatchingContexts.map(function (oCtx) {
                        return oCtx.delete();
                    })).then(function () {
                        oView.setBusy(false);
                        this._setHeartSavedState(false);
                        MessageToast.show("Removed \"" + oBookData.title + "\" from your Wishlist.");
                    }.bind(this));
                }

                // Not on wishlist -> add new entry
                var oCreatedCtx = oWishlistBinding.create({
                    userName: "alice",
                    book_ID: oBookData.bookId
                });

                return oCreatedCtx.created().then(function () {
                    oView.setBusy(false);
                    this._setHeartSavedState(true);
                    MessageToast.show("Added \"" + oBookData.title + "\" to your Wishlist.");
                }.bind(this));
            }.bind(this)).catch(function (oError) {
                oView.setBusy(false);
                MessageBox.error("Failed to update Wishlist: " + (oError.message || "Unknown error"));
            });
        },

        onAddToCart: function () {
            var oView = this.getView();
            var oBookData = this._getCurrentBookData();

            if (!oBookData.bookId) {
                MessageToast.show("Book details are not available yet.");
                return;
            }

            if (oBookData.stock <= 0) {
                MessageBox.warning("This book is currently out of stock.");
                return;
            }

            var oComponent = this.getOwnerComponent();
            var oCartModel = oComponent.getModel("cart");
            var aItems = (oCartModel && oCartModel.getProperty("/items")) || [];
            var oOrderModel = oView.getModel("order") || oComponent.getModel("order");

            var oExisting = aItems.find(function (item) {
                return item.book_ID === oBookData.bookId;
            });

            var iTargetQty = oExisting ? (oExisting.quantity + oBookData.quantity) : oBookData.quantity;
            if (iTargetQty > oBookData.stock) {
                MessageBox.warning("Total cart quantity exceeds available stock (" + oBookData.stock + ").");
                return;
            }

            var sNetAmount = (oBookData.price * iTargetQty).toFixed(2);
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
                    MessageToast.show("Updated \"" + oBookData.title + "\" in cart (" + iTargetQty + ").");
                }).catch(function (oErr) {
                    oView.setBusy(false);
                    MessageBox.error("Failed to update cart item: " + (oErr.message || "Unknown error"));
                });
            } else {
                var oListBinding = oOrderModel.bindList("/CartItems");
                var oCreatedCtx = oListBinding.create({
                    book_ID: oBookData.bookId,
                    quantity: oBookData.quantity,
                    unitPrice: oBookData.price.toFixed(2),
                    netAmount: (oBookData.price * oBookData.quantity).toFixed(2),
                    currency: oBookData.currency
                });

                oCreatedCtx.created().then(function () {
                    return oComponent.loadCartFromBackend ? oComponent.loadCartFromBackend() : Promise.resolve();
                }).then(function () {
                    oView.setBusy(false);
                    MessageToast.show("Added \"" + oBookData.title + "\" to cart.");
                }).catch(function (oErr) {
                    oView.setBusy(false);
                    if (oCreatedCtx && oCreatedCtx.delete) {
                        oCreatedCtx.delete("$auto").catch(function () {});
                    }
                    MessageBox.error("Failed to add item to cart: " + (oErr.message || "Unknown error"));
                });
            }
        },

        onPlaceOrder: function () {
            var oView = this.getView();
            var oBookData = this._getCurrentBookData();

            if (!oBookData.bookId) {
                MessageToast.show("Book details are not available yet.");
                return;
            }

            if (oBookData.stock <= 0 || oBookData.quantity > oBookData.stock) {
                MessageBox.warning("Insufficient stock available for this order.");
                return;
            }

            var sNetAmount = (oBookData.price * oBookData.quantity).toFixed(2);
            var sExpectedDelivery = this._formatExpectedDeliveryDate(new Date());
            var oOrderModel = oView.getModel("order") || this.getOwnerComponent().getModel("order");
            var oListBinding = oOrderModel.bindList("/Orders");

            var oCreatedContext = oListBinding.create({
                currency: oBookData.currency,
                totalPrice: sNetAmount,
                items: [
                    {
                        book_ID: oBookData.bookId,
                        quantity: oBookData.quantity,
                        netAmount: sNetAmount
                    }
                ]
            });

            oView.setBusy(true);
            oCreatedContext.created().then(function () {
                oView.setBusy(false);
                var sOrderNumber = oCreatedContext.getProperty("orderNumber") || "Confirmed";
                MessageBox.success(
                    "Order " + sOrderNumber + " placed for \"" + oBookData.title + "\" (x" + oBookData.quantity + ")!\n\n" +
                    "Total Amount: " + sNetAmount + " " + oBookData.currency + "\n" +
                    "Expected Delivery Date: " + sExpectedDelivery ,
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