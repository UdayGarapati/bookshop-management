sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
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
    "sap/m/Toolbar",
    "sap/m/ToolbarSpacer",
    "sap/m/MessageToast"
], function (
    Controller,
    UIComponent,
    JSONModel,
    Filter,
    FilterOperator,
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
    Toolbar,
    ToolbarSpacer,
    MessageToast
) {
    "use strict";

    return Controller.extend("bookshop.ui.controller.OrderHistory", {
        onInit: function () {
            var oTrackingModel = new JSONModel({
                orderNumber: "",
                status: "PLACED",
                carrier: "DHL Express",
                trackingId: "TRK-987654321",
                trackingState: "In Transit",
                expectedDeliveryFormatted: "",
                totalPrice: "0.00",
                currency: "EUR",
                totalUnits: 0,
                items: []
            });
            this.getView().setModel(oTrackingModel, "tracking");
        },

        onNavBack: function () {
            UIComponent.getRouterFor(this).navTo("Dashboard");
        },

        _formatExpectedDeliveryDate: function (oDateInput) {
            var oDate = oDateInput ? new Date(oDateInput) : new Date();
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

        onTrack: function (oEvent) {
            return this.onOpenTrackingDialog(oEvent);
        },

        onTrackOrder: function (oEvent) {
            return this.onOpenTrackingDialog(oEvent);
        },

        onTrackShipment: function (oEvent) {
            return this.onOpenTrackingDialog(oEvent);
        },

        onOpenTrackingDialog: function (oEvent) {
            var oSource = oEvent.getSource();
            var oOrderContext = oSource.getBindingContext("order") || oSource.getBindingContext();
            if (!oOrderContext) {
                MessageToast.show("Order details not available.");
                return;
            }

            var oOrder = oOrderContext.getObject() || {};
            var sOrderId = oOrder.ID;
            var oView = this.getView();
            var oOrderModel = oOrderContext.getModel();

            if (sOrderId && oOrderModel && oOrderModel.bindList) {
                oView.setBusy(true);
                var oListBinding = oOrderModel.bindList(
                    "/Orders",
                    null,
                    null,
                    [new Filter("ID", FilterOperator.EQ, sOrderId)],
                    {
                        $expand: "items($expand=book)"
                    }
                );

                oListBinding.requestContexts(0, 1).then(function (aContexts) {
                    oView.setBusy(false);
                    var oFullOrder = (aContexts && aContexts.length > 0) ? aContexts[0].getObject() : oOrder;
                    this._populateAndOpenTrackingDialog(oFullOrder);
                }.bind(this)).catch(function () {
                    oView.setBusy(false);
                    this._populateAndOpenTrackingDialog(oOrder);
                }.bind(this));
            } else {
                this._populateAndOpenTrackingDialog(oOrder);
            }
        },

        _populateAndOpenTrackingDialog: function (oOrder) {
            var oTrackingModel = this.getView().getModel("tracking");
            var vRawOrderDate = oOrder.createdAt || oOrder.CreatedAt || oOrder.orderDate || oOrder.OrderDate || new Date();
            var sExpectedDelivery = this._formatExpectedDeliveryDate(vRawOrderDate);
            var sCurrency = oOrder.currency || oOrder.currency_code || "EUR";

            var aRawItems = oOrder.items || [];
            var iTotalUnits = 0;
            var fCalculatedTotal = 0;

            var aFormattedItems = aRawItems.map(function (oItem) {
                var oBook = oItem.book || {};
                var iQty = parseInt(oItem.quantity, 10) || 1;
                var fNet = parseFloat(oItem.netAmount);
                var fUnit = parseFloat(oBook.price);

                if (isNaN(fNet) && !isNaN(fUnit)) {
                    fNet = fUnit * iQty;
                } else if (isNaN(fUnit) && !isNaN(fNet) && iQty > 0) {
                    fUnit = fNet / iQty;
                }

                fNet = isNaN(fNet) ? 0 : fNet;
                fUnit = isNaN(fUnit) ? 0 : fUnit;

                iTotalUnits += iQty;
                fCalculatedTotal += fNet;

                return {
                    title: oBook.title || oItem.bookTitle || "Book",
                    isbn: oBook.isbn || "-",
                    quantity: iQty,
                    unitPrice: fUnit.toFixed(2),
                    netAmount: fNet.toFixed(2),
                    currency: oBook.currency_code || sCurrency
                };
            });

            var fFinalTotal = parseFloat(oOrder.totalPrice);
            if (isNaN(fFinalTotal) || fFinalTotal <= 0) {
                fFinalTotal = fCalculatedTotal;
            }

            var sOrderNumber = oOrder.orderNumber || "ORD-N/A";
            var sNumericSuffix = String(sOrderNumber).replace(/\D/g, "").slice(-6) || "987654";

            oTrackingModel.setData({
                orderNumber: sOrderNumber,
                status: oOrder.status || "PLACED",
                carrier: "DHL Express",
                trackingId: "TRK-" + sNumericSuffix,
                trackingState: oOrder.status === "Delivered" ? "Delivered" : "In Transit",
                expectedDeliveryFormatted: sExpectedDelivery,
                totalPrice: fFinalTotal.toFixed(2),
                currency: sCurrency,
                totalUnits: iTotalUnits,
                items: aFormattedItems
            });

            if (!this._oTrackingDialog) {
                this._createTrackingDialog();
            }
            this._oTrackingDialog.open();
        },

        _createTrackingDialog: function () {
            var oHeaderBar = new Toolbar({
                height: "4rem",
                design: "Solid",
                content: [
                    new VBox({
                        items: [
                            new Title({
                                text: "Tracking Details for {tracking>/orderNumber}",
                                level: "H4"
                            }),
                            new Text({
                                text: "Carrier: {tracking>/carrier}  |  Tracking ID: {tracking>/trackingId}"
                            })
                        ]
                    }),
                    new ToolbarSpacer(),
                    new ObjectStatus({
                        text: "{tracking>/trackingState}",
                        icon: "sap-icon://shipping-status",
                        state: "Information"
                    })
                ]
            });

            var oBooksTable = new Table({
                headerText: "Books Ordered",
                noDataText: "No book line items found for this order.",
                inset: false,
                class: "sapUiMediumMarginTop",
                columns: [
                    new Column({ header: new Text({ text: "Book Title" }), width: "44%" }),
                    new Column({ header: new Text({ text: "Unit Price" }), hAlign: "End", width: "20%" }),
                    new Column({ header: new Text({ text: "Units" }), hAlign: "Center", width: "14%" }),
                    new Column({ header: new Text({ text: "Subtotal" }), hAlign: "End", width: "22%" })
                ],
                items: {
                    path: "tracking>/items",
                    template: new ColumnListItem({
                        vAlign: "Middle",
                        cells: [
                            new ObjectIdentifier({
                                title: "{tracking>title}",
                                text: "ISBN: {tracking>isbn}"
                            }),
                            new ObjectNumber({
                                number: "{tracking>unitPrice}",
                                unit: "{tracking>currency}"
                            }),
                            new ObjectStatus({
                                text: "{tracking>quantity}",
                                state: "None"
                            }),
                            new ObjectNumber({
                                number: "{tracking>netAmount}",
                                unit: "{tracking>currency}",
                                emphasized: true
                            })
                        ]
                    })
                }
            });

            var oSummaryToolbar = new Toolbar({
                height: "3.75rem",
                design: "Info",
                class: "sapUiMediumMarginTop",
                content: [
                    new VBox({
                        items: [
                            new Text({
                                text: "Total Units: {tracking>/totalUnits}"
                            }),
                            new ObjectStatus({
                                text: "Expected Delivery Date: {tracking>/expectedDeliveryFormatted} (7 days from order date)",
                                icon: "sap-icon://appointment-2",
                                state: "Success"
                            })
                        ]
                    }),
                    new ToolbarSpacer(),
                    new HBox({
                        alignItems: "Center",
                        items: [
                            new Title({
                                text: "Total Amount:",
                                level: "H4",
                                class: "sapUiTinyMarginEnd"
                            }),
                            new ObjectNumber({
                                number: "{tracking>/totalPrice}",
                                unit: "{tracking>/currency}",
                                emphasized: true,
                                state: "Success"
                            })
                        ]
                    })
                ]
            });

            this._oTrackingDialog = new Dialog({
                title: "Shipment Tracking",
                icon: "sap-icon://shipping-status",
                contentWidth: "50rem",
                resizable: true,
                draggable: true,
                content: [
                    new VBox({
                        class: "sapUiSmallMargin",
                        items: [
                            oHeaderBar,
                            oBooksTable,
                            oSummaryToolbar
                        ]
                    })
                ],
                endButton: new Button({
                    text: "Close",
                    type: "Emphasized",
                    press: function () {
                        this._oTrackingDialog.close();
                    }.bind(this)
                })
            });

            this.getView().addDependent(this._oTrackingDialog);
        }
    });
});