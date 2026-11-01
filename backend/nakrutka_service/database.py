import aiosqlite
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "bot_database.db")

async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS users (
                user_id INTEGER PRIMARY KEY,
                username TEXT,
                full_name TEXT,
                balance INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        await db.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            )
        """)

        await db.execute("""
            CREATE TABLE IF NOT EXISTS services (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                category TEXT,
                name TEXT,
                price_per_1000 INTEGER,
                min_quantity INTEGER,
                max_quantity INTEGER,
                description TEXT,
                is_active INTEGER DEFAULT 1
            )
        """)

        await db.execute("""
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                service_id INTEGER,
                service_name TEXT,
                target_link TEXT,
                quantity INTEGER,
                total_price INTEGER,
                status TEXT DEFAULT 'pending', -- pending, completed, rejected
                admin_notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        await db.execute("""
            CREATE TABLE IF NOT EXISTS deposits (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                amount INTEGER,
                receipt_file_id TEXT,
                status TEXT DEFAULT 'pending', -- pending, approved, rejected
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Default settings if not exists
        await db.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('card_number', '9860 0000 0000 0000')")
        await db.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('card_holder', 'ADMIN')")
        await db.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('admin_id', '0')")
        await db.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('support_username', '@admin')")

        # Check default services
        cursor = await db.execute("SELECT COUNT(*) FROM services")
        count = (await cursor.fetchone())[0]
        if count == 0:
            default_services = [
                # Telegram
                ("telegram", "🇺🇿 Telegram O'zbek Obunachi (Real/Faol)", 25000, 100, 20000, "100% O'zbek obunachilar kanalingiz uchun."),
                ("telegram", "⚡ Telegram Tezkor Obunachi (Mix/Arzon)", 15000, 100, 50000, "Tez tushuvchi sifatli obunachilar."),
                ("telegram", "👁 Telegram Post Ko'rish (So'nggi 5-10 post)", 5000, 100, 50000, "Barcha yangi postlaringizga prosmotrlar."),
                ("telegram", "❤️ Telegram Reaksiyalar (Mix emojilar)", 8000, 50, 10000, "Turli reaksiyalar tanlagan postingizga."),

                # Instagram
                ("instagram", "🔥 Instagram Jonli O'zbek Obunachilar", 35000, 100, 20000, "O'zbekiston auditoriyasi."),
                ("instagram", "⚡ Instagram Sifatli Obunachilar (Chet el/Mix)", 20000, 100, 50000, "Kafolatli va tez to'ldiriladi."),
                ("instagram", "❤️ Instagram Like (Layklar)", 7000, 100, 25000, "Xohlagan post yoki rasmga layklar."),
                ("instagram", "▶️ Instagram Reels Ko'rishlar", 4000, 500, 100000, "Reels videolarni trendga chiqarish uchun ko'rishlar."),

                # TikTok
                ("tiktok", "🎵 TikTok Obunachilar (Followers)", 30000, 100, 20000, "TikTok profilingiz uchun kuzatuvchilar."),
                ("tiktok", "❤️ TikTok Like & Prosmotr", 10000, 100, 50000, "TikTok videongizga layk va ko'rishlar."),

                # YouTube
                ("youtube", "🔴 YouTube Obunachilar (Subscribers)", 90000, 50, 5000, "Monetizatsiya uchun doimiy obunachilar."),
                ("youtube", "▶️ YouTube Video Ko'rishlar (Views)", 35000, 500, 50000, "Kafolatli uzoq vaqt ushlanuvchi ko'rishlar.")
            ]
            await db.executemany("""
                INSERT INTO services (category, name, price_per_1000, min_quantity, max_quantity, description)
                VALUES (?, ?, ?, ?, ?, ?)
            """, default_services)

        await db.commit()

async def add_or_update_user(user_id: int, username: str, full_name: str):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            INSERT INTO users (user_id, username, full_name)
            VALUES (?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                username=excluded.username,
                full_name=excluded.full_name
        """, (user_id, username, full_name))
        await db.commit()

async def get_user(user_id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM users WHERE user_id = ?", (user_id,))
        row = await cursor.fetchone()
        return dict(row) if row else None

async def change_user_balance(user_id: int, delta: int):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("UPDATE users SET balance = balance + ? WHERE user_id = ?", (delta, user_id))
        await db.commit()

async def create_deposit(user_id: int, amount: int, receipt_file_id: str):
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute("""
            INSERT INTO deposits (user_id, amount, receipt_file_id, status)
            VALUES (?, ?, ?, 'pending')
        """, (user_id, amount, receipt_file_id))
        await db.commit()
        return cursor.lastrowid

async def get_deposit_by_id(dep_id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM deposits WHERE id = ?", (dep_id,))
        row = await cursor.fetchone()
        return dict(row) if row else None

async def update_deposit_status(dep_id: int, status: str):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("UPDATE deposits SET status = ? WHERE id = ?", (status, dep_id))
        await db.commit()

async def get_settings():
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute("SELECT key, value FROM settings")
        rows = await cursor.fetchall()
        return {r[0]: r[1] for r in rows}

async def update_setting(key: str, value: str):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (key, value))
        await db.commit()

async def get_services(category: str = None):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        if category:
            cursor = await db.execute("SELECT * FROM services WHERE category = ? AND is_active = 1", (category,))
        else:
            cursor = await db.execute("SELECT * FROM services WHERE is_active = 1")
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]

async def get_service_by_id(service_id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM services WHERE id = ?", (service_id,))
        row = await cursor.fetchone()
        return dict(row) if row else None

async def create_order(user_id: int, service_id: int, service_name: str, target_link: str, quantity: int, total_price: int):
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute("""
            INSERT INTO orders (user_id, service_id, service_name, target_link, quantity, total_price, status)
            VALUES (?, ?, ?, ?, ?, ?, 'pending')
        """, (user_id, service_id, service_name, target_link, quantity, total_price))
        # Deduct balance
        await db.execute("UPDATE users SET balance = balance - ? WHERE user_id = ?", (total_price, user_id))
        await db.commit()
        return cursor.lastrowid

async def get_order_by_id(order_id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM orders WHERE id = ?", (order_id,))
        row = await cursor.fetchone()
        return dict(row) if row else None

async def update_order_status(order_id: int, status: str, admin_notes: str = ""):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("UPDATE orders SET status = ?, admin_notes = ? WHERE id = ?", (status, admin_notes, order_id))
        await db.commit()

async def refund_order(order_id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute("SELECT user_id, total_price, status FROM orders WHERE id = ?", (order_id,))
        row = await cursor.fetchone()
        if row:
            uid, price, st = row
            await db.execute("UPDATE users SET balance = balance + ? WHERE user_id = ?", (price, uid))
            await db.commit()

async def get_user_orders(user_id: int, limit: int = 10):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT ?", (user_id, limit))
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]

async def get_stats():
    async with aiosqlite.connect(DB_PATH) as db:
        u_cur = await db.execute("SELECT COUNT(*) FROM users")
        total_users = (await u_cur.fetchone())[0]

        o_cur = await db.execute("SELECT COUNT(*), SUM(total_price) FROM orders WHERE status = 'completed'")
        completed_orders, total_revenue = (await o_cur.fetchone())

        pending_cur = await db.execute("SELECT COUNT(*) FROM orders WHERE status = 'pending'")
        pending_orders = (await pending_cur.fetchone())[0]

        dep_cur = await db.execute("SELECT COUNT(*) FROM deposits WHERE status = 'pending'")
        pending_deposits = (await dep_cur.fetchone())[0]

        return {
            "total_users": total_users,
            "completed_orders": completed_orders or 0,
            "pending_orders": pending_orders or 0,
            "pending_deposits": pending_deposits or 0,
            "total_revenue": total_revenue or 0
        }

async def get_all_user_ids():
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute("SELECT user_id FROM users")
        rows = await cursor.fetchall()
        return [r[0] for r in rows]

async def update_service_price(service_id: int, new_price: int):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("UPDATE services SET price_per_1000 = ? WHERE id = ?", (new_price, service_id))
        await db.commit()

async def get_all_services_admin():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM services ORDER BY category, id")
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]

async def add_service(category: str, name: str, price_per_1000: int, min_quantity: int, max_quantity: int, description: str):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            INSERT INTO services (category, name, price_per_1000, min_quantity, max_quantity, description, is_active)
            VALUES (?, ?, ?, ?, ?, ?, 1)
        """, (category, name, price_per_1000, min_quantity, max_quantity, description))
        await db.commit()

async def toggle_service_status(service_id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            UPDATE services 
            SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END 
            WHERE id = ?
        """, (service_id,))
        await db.commit()

async def delete_service(service_id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM services WHERE id = ?", (service_id,))
        await db.commit()
