sap.ui.define(["sap/ui/core/mvc/Controller"], function (Controller) {
    "use strict";
    return Controller.extend("bookshop.ui.controller.Wishlist", {
        onNavBack: function () {
            sap.ui.core.UIComponent.getRouterFor(this).navTo("Dashboard");
        }
    });
});