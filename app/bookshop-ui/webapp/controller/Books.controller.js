sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (Controller, Filter, FilterOperator) {
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
                var oFilter = new Filter("title", FilterOperator.Contains, sQuery);
                oBinding.filter([oFilter]);
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

            // Try getting the ID property directly
            var sBookId = oContext.getProperty("ID");
            
            if (!sBookId) {
                // Fallback: extract ID from path safely handling both quoted string keys and raw keys
                var sPath = oContext.getPath(); // e.g. "/Books('book-01')" or "/Books(1)"
                var iStartIndex = sPath.indexOf("(");
                var iEndIndex = sPath.indexOf(")");
                
                if (iStartIndex !== -1 && iEndIndex !== -1) {
                    sBookId = sPath.substring(iStartIndex + 1, iEndIndex);
                    // Remove surrounding single quotes if present (e.g., 'book-01' -> book-01)
                    sBookId = sBookId.replace(/^['"]|['"]$/g, '');
                }
            }

            if (!sBookId) {
                return;
            }

            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.navTo("Detail", {
                bookId: sBookId
            });
        }
    });
});