package customer.bookshop_management;

import java.math.BigDecimal;
import java.util.List;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import com.sap.cds.ql.Delete;
import com.sap.cds.ql.Insert;
import com.sap.cds.ql.Select;
import com.sap.cds.services.persistence.PersistenceService;

import cds.gen.orderservice.Books;
import cds.gen.orderservice.Books_;

@Component
@Profile("hybrid")
public class DataSeeder implements ApplicationRunner {

    private final PersistenceService db;

    public DataSeeder(PersistenceService db) {
        this.db = db;
    }

    @Override
    public void run(ApplicationArguments args) {
        try {
            // 1. Remove legacy non-UUID rows if present
            db.run(Delete.from(Books_.class).where(b -> b.ID().like("book-%")));

            // 2. Seed books if the Books table is empty
            long count = db.run(Select.from(Books_.class)).listOf(Books.class).size();
            if (count == 0) {
                Books b1 = Books.create();
                b1.setId("32912423-74d1-4191-b3b4-53909796e959");
                b1.setTitle("Wuthering Heights");
                b1.setDescr("A classic novel of passion and tragedy on the Yorkshire moors.");
                b1.setIsbn("9780141439556");
                b1.setPrice(new BigDecimal("12.50"));
                b1.setCurrencyCode("EUR");
                b1.setStock(15);
                b1.setUnitsSold(120);

                Books b2 = Books.create();
                b2.setId("0191c49a-e274-4b45-8f69-7987823f6687");
                b2.setTitle("Design Patterns");
                b2.setDescr("Elements of Reusable Object-Oriented Software.");
                b2.setIsbn("9780201633610");
                b2.setPrice(new BigDecimal("45.00"));
                b2.setCurrencyCode("EUR");
                b2.setStock(8);
                b2.setUnitsSold(340);

                Books b3 = Books.create();
                b3.setId("666993a4-0466-4e5b-b99b-449e6f3b0c26");
                b3.setTitle("Cosmos");
                b3.setDescr("A personal voyage exploring the universe and science history.");
                b3.setIsbn("9780345539434");
                b3.setPrice(new BigDecimal("19.99"));
                b3.setCurrencyCode("EUR");
                b3.setStock(25);
                b3.setUnitsSold(210);

                db.run(Insert.into(Books_.class).entries(List.of(b1, b2, b3)));
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}