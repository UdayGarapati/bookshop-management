sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/json/JSONModel"
], function (Controller, Filter, FilterOperator, JSONModel) {
    "use strict";

    return Controller.extend("bookshop.ui.controller.Books", {

        onNavBack: function () {
            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.navTo("Dashboard");
        },

        onSearch: function (oEvent) {
            var sQuery = oEvent.getSource().getValue();
            var oTable = this.byId("booksTable");
            var oBinding = oTable.getBinding("items");

            if (sQuery && sQuery.length > 0) {
                var aFilters = [
                    new Filter("title", FilterOperator.Contains, sQuery),
                    new Filter("descr", FilterOperator.Contains, sQuery),
                    new Filter("author/name", FilterOperator.Contains, sQuery)
                ];
                oBinding.filter([new Filter({ filters: aFilters, and: false })]);
            } else {
                oBinding.filter([]);
            }
        },

        onBookPress: function (oEvent) {
            var oItem = oEvent.getSource();
            var oContext = oItem.getBindingContext();

            if (!oContext) {
                return;
            }

            var oBook = oContext.getObject();

            var oBookModel = new JSONModel(oBook);
            this.getOwnerComponent().setModel(oBookModel, "selectedBook");

            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.navTo("Detail", {
                bookId: oBook.ID
            });
        }
    });
});