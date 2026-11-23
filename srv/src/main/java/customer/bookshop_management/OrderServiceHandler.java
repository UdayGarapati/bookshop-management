package customer.bookshop_management;

import java.math.BigDecimal;
import java.time.Year;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Component;

import com.sap.cds.ql.Select;
import com.sap.cds.ql.Update;
import com.sap.cds.services.ErrorStatuses;
import com.sap.cds.services.ServiceException;
import com.sap.cds.services.cds.CqnService;
import com.sap.cds.services.handler.EventHandler;
import com.sap.cds.services.handler.annotations.After;
import com.sap.cds.services.handler.annotations.Before;
import com.sap.cds.services.handler.annotations.ServiceName;
import com.sap.cds.services.persistence.PersistenceService;

import cds.gen.orderservice.Books;
import cds.gen.orderservice.Books_;
import cds.gen.orderservice.OrderItems;
import cds.gen.orderservice.OrderService_;
import cds.gen.orderservice.Orders;
import cds.gen.orderservice.Orders_;

@Component
@ServiceName(OrderService_.CDS_NAME)
public class OrderServiceHandler implements EventHandler {

    private final PersistenceService db;

    public OrderServiceHandler(PersistenceService db) {
        this.db = db;
    }

    @Before(event = CqnService.EVENT_CREATE, entity = Orders_.CDS_NAME)
    public void beforeCreateOrder(List<Orders> orders) {
        int currentYear = Year.now().getValue();
        String prefix = "ORD-" + currentYear + "-";
        int nextSequence = findNextSequenceNumber(prefix);

        // Track cumulative requested quantities per book across the batch
        Map<String, Integer> requestedQtyByBook = new HashMap<>();

        for (Orders order : orders) {
            if (order.getId() == null || order.getId().isBlank()) {
                order.setId(UUID.randomUUID().toString());
            }

            if (order.getOrderNumber() == null || order.getOrderNumber().isBlank()) {
                String formattedNumber = String.format("%s%03d", prefix, nextSequence++);
                order.setOrderNumber(formattedNumber);
            }

            if (order.getStatus() == null || order.getStatus().isBlank()) {
                order.setStatus("PLACED");
            }

            if (order.getCurrency() == null || order.getCurrency().isBlank()) {
                order.setCurrency("EUR");
            }

            BigDecimal calculatedTotal = BigDecimal.ZERO;
            List<OrderItems> items = order.getItems();
            if (items != null) {
                for (OrderItems item : items) {
                    String bookId = item.getBookId();
                    Integer qty = item.getQuantity();
                    if (bookId != null && !bookId.isBlank() && qty != null && qty > 0) {
                        requestedQtyByBook.merge(bookId, qty, Integer::sum);

                        Books book = db.run(
                            Select.from(Books_.class).where(b -> b.ID().eq(bookId))
                        ).first(Books.class).orElse(null);

                        if (book != null && book.getPrice() != null) {
                            BigDecimal lineAmount = book.getPrice().multiply(BigDecimal.valueOf(qty));
                            if (item.getNetAmount() == null) {
                                item.setNetAmount(lineAmount);
                            }
                            calculatedTotal = calculatedTotal.add(lineAmount);
                        } else if (item.getNetAmount() != null) {
                            calculatedTotal = calculatedTotal.add(item.getNetAmount());
                        }
                    }
                }
            }

            if (order.getTotalPrice() == null && calculatedTotal.compareTo(BigDecimal.ZERO) > 0) {
                order.setTotalPrice(calculatedTotal);
            }
        }

        // Validate stock availability before inserting the order
        for (Map.Entry<String, Integer> entry : requestedQtyByBook.entrySet()) {
            String bookId = entry.getKey();
            int qtyNeeded = entry.getValue();

            Books book = db.run(
                Select.from(Books_.class).where(b -> b.ID().eq(bookId))
            ).first(Books.class).orElseThrow(() ->
                new ServiceException(ErrorStatuses.NOT_FOUND, "Book not found: " + bookId)
            );

            int currentStock = book.getStock() != null ? book.getStock() : 0;
            if (currentStock < qtyNeeded) {
                throw new ServiceException(
                    ErrorStatuses.CONFLICT,
                    "Insufficient stock for '" + book.getTitle() + "'. Available: " + currentStock + ", Requested: " + qtyNeeded
                );
            }
        }
    }

    @After(event = CqnService.EVENT_CREATE, entity = Orders_.CDS_NAME)
    public void afterCreateOrder(List<Orders> orders) {
        for (Orders order : orders) {
            List<OrderItems> items = order.getItems();
            if (items == null || items.isEmpty()) {
                continue;
            }

            for (OrderItems item : items) {
                String bookId = item.getBookId();
                Integer qty = item.getQuantity();
                if (bookId == null || bookId.isBlank() || qty == null || qty <= 0) {
                    continue;
                }

                Books book = db.run(
                    Select.from(Books_.class).where(b -> b.ID().eq(bookId))
                ).first(Books.class).orElse(null);

                if (book != null) {
                    int currentStock = book.getStock() != null ? book.getStock() : 0;
                    int updatedStock = Math.max(0, currentStock - qty);

                    int currentSold = book.getUnitsSold() != null ? book.getUnitsSold() : 0;
                    int updatedSold = currentSold + qty;

                    Books updateData = Books.create();
                    updateData.setStock(updatedStock);
                    updateData.setUnitsSold(updatedSold);

                    db.run(
                        Update.entity(Books_.class)
                            .data(updateData)
                            .where(b -> b.ID().eq(bookId))
                    );
                }
            }
        }
    }

    private int findNextSequenceNumber(String prefix) {
        List<Orders> existingOrders = db.run(
            Select.from(Orders_.class).columns(o -> o.orderNumber())
        ).listOf(Orders.class);

        int maxSeq = 0;
        for (Orders existing : existingOrders) {
            String orderNo = existing.getOrderNumber();
            if (orderNo != null && orderNo.startsWith(prefix)) {
                String suffix = orderNo.substring(prefix.length());
                try {
                    int num = Integer.parseInt(suffix);
                    if (num > maxSeq) {
                        maxSeq = num;
                    }
                } catch (NumberFormatException ignored) {
                    // Skip non-numeric suffixes
                }
            }
        }
        return maxSeq + 1;
    }
}