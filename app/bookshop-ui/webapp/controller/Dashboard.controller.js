sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/Table",
    "sap/m/Column",
    "sap/m/ColumnListItem",
    "sap/m/HBox",
    "sap/m/VBox",
    "sap/m/Text",
    "sap/m/Title",
    "sap/m/ObjectIdentifier",
    "sap/m/ObjectNumber",
    "sap/m/ObjectStatus",
    "sap/m/StepInput",
    "sap/m/Toolbar",
    "sap/m/ToolbarSpacer",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (
    Controller,
    UIComponent,
    Dialog,
    Button,
    Table,
    Column,
    ColumnListItem,
    HBox,
    VBox,
    Text,
    Title,
    ObjectIdentifier,
    ObjectNumber,
    ObjectStatus,
    StepInput,
    Toolbar,
    ToolbarSpacer,
    MessageBox,
    MessageToast
) {
    "use strict";

    return Controller.extend("bookshop.ui.controller.Dashboard", {
        onNavToCatalog: function () {
            UIComponent.getRouterFor(this).navTo("Books");
        },

        onNavToOrders: function () {
            UIComponent.getRouterFor(this).navTo("OrderHistory");
        },

        onNavToWishlist: function () {
            UIComponent.getRouterFor(this).navTo("Wishlist");
        },

        onNavToSales: function () {
            UIComponent.getRouterFor(this).navTo("Sales");
        },

        _recalculateCart: function (oCartModel) {
            var aItems = oCartModel.getProperty("/items") || [];
            this.getOwnerComponent().recalculateCartModel(aItems);
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

        _syncCartItemQuantityToBackend: function (oCartItem) {
            var oOrderModel = this.getView().getModel("order") || this.getView().getModel();
            if (!oOrderModel || !oOrderModel.bindList || !oCartItem || !oCartItem.cartItemId) {
                return;
            }

            var iQty = parseInt(oCartItem.quantity, 10) || 1;
            var sNet = ((parseFloat(oCartItem.price) || 0) * iQty).toFixed(2);

            oOrderModel.bindList("/CartItems").requestContexts(0, 100).then(function (aCtx) {
                var oTargetCtx = aCtx.find(function (c) {
                    return c.getProperty("ID") === oCartItem.cartItemId;
                });
                if (oTargetCtx) {
                    oTargetCtx.setProperty("quantity", iQty);
                    oTargetCtx.setProperty("netAmount", sNet);
                }
            }).catch(function () {});
        },

        _deleteCartItemFromBackend: function (sCartItemId) {
            var oOrderModel = this.getView().getModel("order") || this.getView().getModel();
            if (!oOrderModel || !oOrderModel.bindList || !sCartItemId) {
                return Promise.resolve();
            }

            return oOrderModel.bindList("/CartItems").requestContexts(0, 100).then(function (aCtx) {
                var oTargetCtx = aCtx.find(function (c) {
                    return c.getProperty("ID") === sCartItemId;
                });
                return oTargetCtx ? oTargetCtx.delete("$auto") : Promise.resolve();
            }).catch(function () {});
        },

        _clearCartBackend: function () {
            var oOrderModel = this.getView().getModel("order") || this.getView().getModel();
            if (!oOrderModel || !oOrderModel.bindList) {
                return Promise.resolve();
            }

            return oOrderModel.bindList("/CartItems").requestContexts(0, 100).then(function (aCtx) {
                return Promise.all(aCtx.map(function (c) {
                    return c.delete("$auto").catch(function () {});
                }));
            }).catch(function () {});
        },

        onOpenCartDialog: function () {
            var oView = this.getView();
            var oComponent = this.getOwnerComponent();
            var oCartModel = oComponent.getModel("cart");

            oComponent.loadCartFromBackend().then(function () {
                this._recalculateCart(oCartModel);

                if (this._oCartDialog) {
                    this._oCartDialog.open();
                    return;
                }

                var oCartTable = new Table({
                    noDataText: "Your cart is empty. Open a book detail page to add books to your cart.",
                    inset: false,
                    columns: [
                        new Column({
                            header: new Text({ text: "Book Details" }),
                            width: "44%"
                        }),
                        new Column({
                            header: new Text({ text: "Quantity" }),
                            hAlign: "Center",
                            width: "24%"
                        }),
                        new Column({
                            header: new Text({ text: "Subtotal" }),
                            hAlign: "End",
                            width: "22%"
                        }),
                        new Column({
                            header: new Text({ text: "" }),
                            hAlign: "Center",
                            width: "10%"
                        })
                    ],
                    items: {
                        path: "cart>/items",
                        template: new ColumnListItem({
                            vAlign: "Middle",
                            cells: [
                                new VBox({
                                    items: [
                                        new ObjectIdentifier({
                                            title: "{cart>title}",
                                            text: "Unit Price: {cart>price} {cart>currency}"
                                        }),
                                        new ObjectStatus({
                                            text: "{cart>stock} in stock",
                                            state: "Success"
                                        }).addStyleClass("sapUiTinyMarginTop")
                                    ]
                                }).addStyleClass("sapUiTinyMarginTopBottom"),
                                new StepInput({
                                    value: "{cart>quantity}",
                                    min: 1,
                                    max: "{cart>stock}",
                                    width: "115px",
                                    change: function (oEvent) {
                                        var oCtx = oEvent.getSource().getBindingContext("cart");
                                        var oItem = oCtx && oCtx.getObject();
                                        this._recalculateCart(oCartModel);
                                        if (oItem) {
                                            this._syncCartItemQuantityToBackend(oItem);
                                        }
                                    }.bind(this)
                                }),
                                new ObjectNumber({
                                    number: "{cart>netAmount}",
                                    unit: "{cart>currency}",
                                    emphasized: true
                                }),
                                new Button({
                                    icon: "sap-icon://delete",
                                    type: "Transparent",
                                    tooltip: "Remove item",
                                    press: function (oEvent) {
                                        var oCtx = oEvent.getSource().getBindingContext("cart");
                                        var sPath = oCtx && oCtx.getPath();
                                        var oItem = oCtx && oCtx.getObject();
                                        if (!sPath) {
                                            return;
                                        }
                                        var iIndex = parseInt(sPath.split("/").pop(), 10);
                                        var aItems = oCartModel.getProperty("/items") || [];
                                        if (!isNaN(iIndex) && iIndex >= 0) {
                                            aItems.splice(iIndex, 1);
                                            oCartModel.setProperty("/items", aItems);
                                            this._recalculateCart(oCartModel);
                                            if (oItem && oItem.cartItemId) {
                                                this._deleteCartItemFromBackend(oItem.cartItemId);
                                            }
                                        }
                                    }.bind(this)
                                })
                            ]
                        })
                    }
                }).addStyleClass("sapUiMediumMarginTop");

                var oTotalTitle = new Title({
                    text: "Total:",
                    level: "H4"
                }).addStyleClass("sapUiTinyMarginEnd");

                var oSummaryToolbar = new Toolbar({
                    height: "3.5rem",
                    design: "Info",
                    content: [
                        new VBox({
                            items: [
                                new Text({
                                    text: "Items in Cart: {cart>/totalCount}"
                                }),
                                new ObjectStatus({
                                    text: "Expected Delivery: " + this._formatExpectedDeliveryDate(new Date()) + " (7 days)",
                                    icon: "sap-icon://shipping-status",
                                    state: "Information"
                                })
                            ]
                        }),
                        new ToolbarSpacer(),
                        new HBox({
                            alignItems: "Center",
                            items: [
                                oTotalTitle,
                                new ObjectNumber({
                                    number: "{cart>/totalAmount}",
                                    unit: "{cart>/currency}",
                                    emphasized: true,
                                    state: "Success"
                                })
                            ]
                        })
                    ]
                }).addStyleClass("sapUiMediumMarginTop");

                var oDialogContent = new VBox({
                    items: [oCartTable, oSummaryToolbar]
                }).addStyleClass("sapUiSmallMargin");

                this._oCartDialog = new Dialog({
                    title: "Shopping Cart",
                    icon: "sap-icon://cart",
                    contentWidth: "50rem",
                    resizable: true,
                    draggable: true,
                    content: [oDialogContent],
                    beginButton: new Button({
                        text: "Place All Orders",
                        type: "Emphasized",
                        icon: "sap-icon://accept",
                        enabled: "{= Number(${cart>/totalCount}) > 0 }",
                        press: this.onCheckoutCart.bind(this)
                    }),
                    endButton: new Button({
                        text: "Close",
                        press: function () {
                            this._oCartDialog.close();
                        }.bind(this)
                    })
                });

                oView.addDependent(this._oCartDialog);
                this._oCartDialog.open();
            }.bind(this));
        },

        onCheckoutCart: function () {
            var oView = this.getView();
            var oCartModel = this.getOwnerComponent().getModel("cart");
            this._recalculateCart(oCartModel);

            var aCartItems = oCartModel.getProperty("/items") || [];
            if (aCartItems.length === 0) {
                MessageToast.show("Your cart is empty.");
                return;
            }

            for (var i = 0; i < aCartItems.length; i++) {
                var iQty = parseInt(aCartItems[i].quantity, 10) || 1;
                var iStock = parseInt(aCartItems[i].stock, 10) || 0;
                if (iStock <= 0 || iQty > iStock) {
                    MessageBox.warning(
                        "Quantity for \"" + aCartItems[i].title + "\" (" + iQty + ") exceeds available stock (" + iStock + ")."
                    );
                    return;
                }
            }

            var sTotalPrice = oCartModel.getProperty("/totalAmount");
            var sCurrency = oCartModel.getProperty("/currency") || "EUR";
            var sExpectedDelivery = this._formatExpectedDeliveryDate(new Date());

            var aOrderItems = aCartItems.map(function (oItem) {
                var iQty = parseInt(oItem.quantity, 10) || 1;
                var fNet = (parseFloat(oItem.price) || 0) * iQty;
                return {
                    book_ID: oItem.book_ID,
                    quantity: iQty,
                    netAmount: fNet.toFixed(2)
                };
            });

            var oOrderModel = oView.getModel("order");
            var oListBinding = oOrderModel.bindList("/Orders");

            var oCreatedContext = oListBinding.create({
                currency: sCurrency,
                totalPrice: sTotalPrice,
                items: aOrderItems
            });

            oView.setBusy(true);
            oCreatedContext.created().then(function () {
                return this._clearCartBackend().then(function () {
                    oView.setBusy(false);
                    var sOrderNumber = oCreatedContext.getProperty("orderNumber") || "Confirmed";
                    var iItemCount = aOrderItems.length;

                    oCartModel.setProperty("/items", []);
                    this._recalculateCart(oCartModel);

                    if (this._oCartDialog && this._oCartDialog.isOpen()) {
                        this._oCartDialog.close();
                    }

                    MessageBox.success(
                        "Order " + sOrderNumber + " placed for " + iItemCount + " book(s)!\n\n" +
                        "Total Amount: " + sTotalPrice + " " + sCurrency + "\n" +
                        "Expected Delivery Date: " + sExpectedDelivery + " (7 days from order date)",
                        {
                            title: "Order Confirmed",
                            onClose: function () {
                                UIComponent.getRouterFor(this).navTo("OrderHistory");
                            }.bind(this)
                        }
                    );
                }.bind(this));
            }.bind(this)).catch(function (oError) {
                oView.setBusy(false);
                if (oCreatedContext && oCreatedContext.delete) {
                    oCreatedContext.delete("$auto").catch(function () {});
                }
                var sMessage = (oError && oError.message) ? oError.message : "Unknown error";
                MessageBox.error("Failed to place order: " + sMessage);
            });
        }
    });
});