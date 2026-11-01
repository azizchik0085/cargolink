import asyncio
import logging
import os
import re
from aiogram import Bot, Dispatcher, F, types
from aiogram.filters import Command, CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import (
    FSInputFile,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    KeyboardButton,
    ReplyKeyboardMarkup,
    ReplyKeyboardRemove,
)

import database as db

BOT_TOKEN = "9197059977:AAHWsLdF8cu-tvCUULU6KtyhJZyap3b2Uc8"

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher(storage=MemoryStorage())

# States
class OrderState(StatesGroup):
    choosing_service = State()
    entering_link = State()
    entering_quantity = State()
    confirm_order = State()

class DepositState(StatesGroup):
    entering_amount = State()
    uploading_receipt = State()

class AdminCardState(StatesGroup):
    entering_card = State()

class AdminPriceState(StatesGroup):
    entering_new_price = State()

class AdminNewServiceState(StatesGroup):
    choosing_platform = State()
    entering_name = State()
    entering_price = State()
    entering_min_qty = State()
    entering_max_qty = State()
    entering_desc = State()

class AdminBroadcastState(StatesGroup):
    entering_text = State()

class AdminRejectState(StatesGroup):
    entering_reason = State()

# Keyboards
def get_main_keyboard(is_admin: bool = False):
    buttons = [
        [KeyboardButton(text="🚀 Xizmatlar (SMM Nakrutka)")],
        [KeyboardButton(text="💰 Balans / To'ldirish"), KeyboardButton(text="📋 Buyurtmalarim")],
        [KeyboardButton(text="💳 To'lov rekvizitlari"), KeyboardButton(text="📞 Yordam")],
        [KeyboardButton(text="ℹ️ Qoidalar")]
    ]
    if is_admin:
        buttons.append([KeyboardButton(text="⚙️ Admin Panel")])
    return ReplyKeyboardMarkup(keyboard=buttons, resize_keyboard=True)

def get_platform_keyboard():
    kb = [
        [
            InlineKeyboardButton(text="✈️ Telegram", callback_data="plat_telegram"),
            InlineKeyboardButton(text="📸 Instagram", callback_data="plat_instagram")
        ],
        [
            InlineKeyboardButton(text="🎵 TikTok", callback_data="plat_tiktok"),
            InlineKeyboardButton(text="🔴 YouTube", callback_data="plat_youtube")
        ]
    ]
    return InlineKeyboardMarkup(inline_keyboard=kb)

async def check_is_admin(user_id: int) -> bool:
    settings = await db.get_settings()
    admin_id = int(settings.get("admin_id", 0))
    return user_id == admin_id

# /start Handler
@dp.message(CommandStart())
async def cmd_start(message: types.Message, state: FSMContext):
    await state.clear()
    user = message.from_user
    await db.add_or_update_user(user.id, user.username or "", user.full_name or "")
    
    settings = await db.get_settings()
    admin_id = int(settings.get("admin_id", 0))
    is_admin = (user.id == admin_id)
    
    user_data = await db.get_user(user.id)
    balance = user_data["balance"] if user_data else 0
    balance_str = f"{balance:,}".replace(",", " ")
    
    welcome_text = (
        f"Assalomu alaykum, {user.first_name}! 👋\n\n"
        f"🚀 **Nakrutka xizmatlari**\n"
        f"📲 **Telegram | Instagram | TikTok | YouTube**\n"
        f"👥 **Obunachi • Layk • Ko‘rish**\n"
        f"⚡ **Tezkor va qulay narxlar!**\n\n"
        f"💳 **Sizning balansingiz:** `{balance_str} so'm`\n\n"
        f"👇 Kerakli bo'limni tanlang:"
    )
    
    welcome_img_path = os.path.join(os.path.dirname(__file__), "welcome.jpg")
    if os.path.exists(welcome_img_path):
        photo = FSInputFile(welcome_img_path)
        await message.answer_photo(
            photo=photo,
            caption=welcome_text,
            parse_mode="Markdown",
            reply_markup=get_main_keyboard(is_admin)
        )
    else:
        await message.answer(welcome_text, parse_mode="Markdown", reply_markup=get_main_keyboard(is_admin))

# Claim Admin Secret Command
@dp.message(Command("make_me_admin"))
async def cmd_make_admin(message: types.Message):
    user_id = message.from_user.id
    await db.update_setting("admin_id", str(user_id))
    await message.answer(
        f"✅ Siz muvaffaqiyatli ADMIN qilib tayinlandingiz! (ID: {user_id})\n"
        f"Barcha tushgan buyurtmalar va to'lov cheklari endi sizga yuboriladi.",
        reply_markup=get_main_keyboard(True)
    )

# 💰 BALANS VA HISOBNI TO'LDIRISH
@dp.message(F.text == "💰 Balans / To'ldirish")
async def show_balance(message: types.Message, state: FSMContext):
    await state.clear()
    uid = message.from_user.id
    user_data = await db.get_user(uid)
    balance = user_data["balance"] if user_data else 0
    b_str = f"{balance:,}".replace(",", " ")
    
    text = (
        f"💰 **Sizning shaxsiy balansingiz:**\n\n"
        f"💵 Hisobingizda: **{b_str} so'm** mavjud.\n\n"
        f"Xizmatlardan foydalanish uchun balansingizdan to'g'ridan-to'g'ri foydalanishingiz mumkin. "
        f"Har bir buyurtma balansingizdan avtomatik yechib olinadi."
    )
    kb = [
        [InlineKeyboardButton(text="💳 Balansni to'ldirish (Pul kiritish)", callback_data="deposit_start")]
    ]
    await message.answer(text, parse_mode="Markdown", reply_markup=InlineKeyboardMarkup(inline_keyboard=kb))

@dp.callback_query(F.data == "deposit_start")
async def deposit_start_handler(callback: types.CallbackQuery, state: FSMContext):
    await callback.message.answer(
        "💳 **Qancha miqdorda hisobingizni to'ldirmoqchisiz?**\n\n"
        "Summani butun sonda so'mda yuboring:\n"
        "*(Masalan: `10000`, `25000`, `50000`)*",
        parse_mode="Markdown"
    )
    await state.set_state(DepositState.entering_amount)
    await callback.answer()

@dp.message(DepositState.entering_amount)
async def process_deposit_amount(message: types.Message, state: FSMContext):
    txt = message.text.strip().replace(" ", "")
    if not txt.isdigit():
        await message.answer("⚠️ Iltimos, summani faqat butun sonda kiriting! (Masalan: `15000`)")
        return
    
    amount = int(txt)
    if amount < 1000:
        await message.answer("⚠️ Minimal to'ldirish summasi: 1 000 so'm")
        return
    
    await state.update_data(deposit_amount=amount)
    settings = await db.get_settings()
    card_number = settings.get("card_number", "8600 0000 0000 0000")
    card_holder = settings.get("card_holder", "ADMIN")
    
    a_str = f"{amount:,}".replace(",", " ")
    text = (
        f"💳 **To'lov ma'lumotlari:**\n\n"
        f"💰 To'ldiriladigan summa: **{a_str} so'm**\n\n"
        f"To'lov uchun karta:\n"
        f"💳 `{card_number}`\n"
        f"👤 Egasi: **{card_holder}**\n\n"
        f"To'lovni **Click, Payme, Uzum** orqali amalga oshiring va "
        f"**chek skrinshotini (rasmini)** shu yerga yuboring 👇"
    )
    cancel_kb = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="❌ Bekor qilish", callback_data="cancel_order")]])
    await message.answer(text, parse_mode="Markdown", reply_markup=cancel_kb)
    await state.set_state(DepositState.uploading_receipt)

@dp.message(DepositState.uploading_receipt, F.photo | F.document)
async def process_deposit_receipt(message: types.Message, state: FSMContext):
    data = await state.get_data()
    amount = data["deposit_amount"]
    file_id = message.photo[-1].file_id if message.photo else message.document.file_id
    user = message.from_user
    
    dep_id = await db.create_deposit(user.id, amount, file_id)
    await state.clear()
    
    a_str = f"{amount:,}".replace(",", " ")
    await message.answer(
        f"✅ **Chekingiz qabul qilindi!** (ID: `#{dep_id}`)\n\n"
        f"Summa: **{a_str} so'm**\n"
        f"Administrator to'lovni tekshirib, balansingizga pulni tez orada o'tkazib beradi va sizga xabar keladi! 🤝",
        parse_mode="Markdown"
    )
    
    # Notify Admin
    settings = await db.get_settings()
    admin_id = int(settings.get("admin_id", 0))
    if admin_id != 0:
        admin_text = (
            f"💰 **YANGI BALANS TO'LDIRISH SO'ROVI #{dep_id}!**\n\n"
            f"👤 **Foydalanuvchi:** {user.full_name} (@{user.username or 'yoq'}, ID: `{user.id}`)\n"
            f"💵 **Kiritilgan summa:** **{a_str} so'm**\n\n"
            f"Chek to'g'ri bo'lsa 'Tasdiqlash' tugmasini bosing, pul avtomatik foydalanuvchi balansiga qo'shiladi 👇"
        )
        admin_kb = InlineKeyboardMarkup(inline_keyboard=[
            [
                InlineKeyboardButton(text="✅ Tasdiqlash (Balansga qo'shish)", callback_data=f"dep_approve_{dep_id}"),
                InlineKeyboardButton(text="❌ Rad etish", callback_data=f"dep_reject_{dep_id}")
            ]
        ])
        try:
            if message.photo:
                await bot.send_photo(chat_id=admin_id, photo=file_id, caption=admin_text, parse_mode="Markdown", reply_markup=admin_kb)
            else:
                await bot.send_document(chat_id=admin_id, document=file_id, caption=admin_text, parse_mode="Markdown", reply_markup=admin_kb)
        except Exception as e:
            logger.error(f"Error sending deposit receipt to admin: {e}")

@dp.message(DepositState.uploading_receipt)
async def wrong_deposit_receipt(message: types.Message):
    await message.answer("⚠️ Iltimos, to'lov chekini rasm (skrinshot) yoki hujjat ko'rinishida yuboring!")

# Admin Actions on Deposits
@dp.callback_query(F.data.startswith("dep_approve_"))
async def admin_approve_deposit(callback: types.CallbackQuery):
    is_admin = await check_is_admin(callback.from_user.id)
    if not is_admin:
        await callback.answer("Siz admin emassiz!", show_alert=True)
        return
    
    dep_id = int(callback.data.split("_")[2])
    dep = await db.get_deposit_by_id(dep_id)
    if not dep or dep["status"] != "pending":
        await callback.answer("Bu so'rov allaqachon ko'rib chiqilgan!", show_alert=True)
        return
    
    await db.update_deposit_status(dep_id, "approved")
    await db.change_user_balance(dep["user_id"], dep["amount"])
    
    a_str = f"{dep['amount']:,}".replace(",", " ")
    try:
        user = await db.get_user(dep["user_id"])
        new_b = f"{user['balance']:,}".replace(",", " ")
        msg = (
            f"🎉 **To'lovingiz tasdiqlandi!**\n\n"
            f"💵 Balansingizga: **+{a_str} so'm** qo'shildi!\n"
            f"💰 Hozirgi balansingiz: **{new_b} so'm**\n\n"
            f"Endi bemalol '🚀 Xizmatlar' bo'limidan buyurtma berishingiz mumkin! 😊"
        )
        await bot.send_message(chat_id=dep["user_id"], text=msg, parse_mode="Markdown")
    except Exception as e:
        logger.error(f"Error notifying user on deposit: {e}")
    
    await callback.message.edit_caption(
        caption=f"{callback.message.caption}\n\n✅ **ADMIN TASDIQLADI! Pul balansga qo'shildi.**",
        reply_markup=None
    )
    await callback.answer("Balans to'ldirildi!", show_alert=True)

@dp.callback_query(F.data.startswith("dep_reject_"))
async def admin_reject_deposit(callback: types.CallbackQuery):
    is_admin = await check_is_admin(callback.from_user.id)
    if not is_admin:
        await callback.answer("Siz admin emassiz!", show_alert=True)
        return
    
    dep_id = int(callback.data.split("_")[2])
    dep = await db.get_deposit_by_id(dep_id)
    if not dep or dep["status"] != "pending":
        await callback.answer("Bu so'rov allaqachon ko'rib chiqilgan!", show_alert=True)
        return
    
    await db.update_deposit_status(dep_id, "rejected")
    try:
        msg = (
            f"❌ **To'lovingiz rad etildi!**\n\n"
            f"Summa: {dep['amount']:,} so'm\n"
            f"Chek tasdiqlanmadi yoki pul tushmadi. Savollar bo'lsa adminga murojaat qiling."
        ).replace(",", " ")
        await bot.send_message(chat_id=dep["user_id"], text=msg, parse_mode="Markdown")
    except Exception as e:
        logger.error(f"Error notifying user on deposit reject: {e}")
    
    await callback.message.edit_caption(
        caption=f"{callback.message.caption}\n\n❌ **RAD ETILDI.**",
        reply_markup=None
    )
    await callback.answer("Rad etildi!", show_alert=True)

# 🚀 BUYURTMA BERISH (BALANSDAN YECHISH BILAN)
@dp.message(F.text == "🚀 Xizmatlar (SMM Nakrutka)")
async def show_platforms(message: types.Message, state: FSMContext):
    await state.clear()
    text = "🌐 **Ijtimoiy tarmoqni tanlang:**\nQaysi tarmoqqa buyurtma bermoqchisiz?"
    await message.answer(text, parse_mode="Markdown", reply_markup=get_platform_keyboard())

@dp.callback_query(F.data.startswith("plat_"))
async def platform_selected(callback: types.CallbackQuery, state: FSMContext):
    platform = callback.data.split("_")[1]
    services = await db.get_services(category=platform)
    
    if not services:
        await callback.message.edit_text("Hozircha bu tarmoqda xizmatlar mavjud emas.")
        await callback.answer()
        return

    kb = []
    for s in services:
        price_str = f"{s['price_per_1000']:,} so'm / 1000 ta".replace(",", " ")
        btn_text = f"{s['name']} — {price_str}"
        kb.append([InlineKeyboardButton(text=btn_text, callback_data=f"srv_{s['id']}")])
    
    kb.append([InlineKeyboardButton(text="⬅️ Ortga", callback_data="back_to_platforms")])
    
    plat_names = {
        "telegram": "✈️ Telegram xizmatlari",
        "instagram": "📸 Instagram xizmatlari",
        "tiktok": "🎵 TikTok xizmatlari",
        "youtube": "🔴 YouTube xizmatlari"
    }
    header = plat_names.get(platform, "Xizmatlar")
    await callback.message.edit_text(f"📊 **{header}:**\n\nKerakli xizmat turini bosing:", parse_mode="Markdown", reply_markup=InlineKeyboardMarkup(inline_keyboard=kb))
    await callback.answer()

@dp.callback_query(F.data == "back_to_platforms")
async def back_to_plat(callback: types.CallbackQuery, state: FSMContext):
    await callback.message.edit_text("🌐 **Ijtimoiy tarmoqni tanlang:**", parse_mode="Markdown", reply_markup=get_platform_keyboard())
    await callback.answer()

@dp.callback_query(F.data.startswith("srv_"))
async def service_selected(callback: types.CallbackQuery, state: FSMContext):
    srv_id = int(callback.data.split("_")[1])
    service = await db.get_service_by_id(srv_id)
    if not service:
        await callback.answer("Xizmat topilmadi!", show_alert=True)
        return
    
    user = await db.get_user(callback.from_user.id)
    user_balance = user["balance"] if user else 0
    b_str = f"{user_balance:,}".replace(",", " ")
    
    await state.update_data(
        service_id=service["id"],
        service_name=service["name"],
        price_per_1000=service["price_per_1000"],
        min_qty=service["min_quantity"],
        max_qty=service["max_quantity"]
    )
    
    info_text = (
        f"📌 **Xizmat:** {service['name']}\n"
        f"📝 **Tavsif:** {service['description']}\n\n"
        f"💰 **Narxi:** {service['price_per_1000']:,} so'm / 1 000 ta\n"
        f"📉 **Minimal buyurtma:** {service['min_quantity']:,} ta\n"
        f"📈 **Maksimal buyurtma:** {service['max_quantity']:,} ta\n"
        f"💵 **Sizning balansingiz:** `{b_str} so'm`\n\n"
        f"🔗 **Kanal, guruh, profil yoki post havolasini (link) yuboring:**\n"
        f"*(Masalan: https://t.me/kanal_nomi yoki https://instagram.com/profil)*"
    ).replace(",", " ")
    
    cancel_kb = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="❌ Bekor qilish", callback_data="cancel_order")]])
    await callback.message.edit_text(info_text, parse_mode="Markdown", reply_markup=cancel_kb)
    await state.set_state(OrderState.entering_link)
    await callback.answer()

@dp.message(OrderState.entering_link)
async def process_link(message: types.Message, state: FSMContext):
    link = message.text.strip()
    if not (link.startswith("http://") or link.startswith("https://") or link.startswith("@") or link.startswith("t.me")):
        await message.answer("⚠️ Iltimos, to'g'ri havola (link) kiriting!\nMasalan: `https://t.me/kanal` yoki `@username`")
        return
    
    await state.update_data(target_link=link)
    data = await state.get_data()
    min_q = data["min_qty"]
    max_q = data["max_qty"]
    
    cancel_kb = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="❌ Bekor qilish", callback_data="cancel_order")]])
    await message.answer(
        f"🔢 Endi **kerakli sonni (miqdorni)** kiriting:\n\n"
        f"• Kamida: {min_q:,} ta\n"
        f"• Ko'pi bilan: {max_q:,} ta".replace(",", " "),
        parse_mode="Markdown",
        reply_markup=cancel_kb
    )
    await state.set_state(OrderState.entering_quantity)

@dp.message(OrderState.entering_quantity)
async def process_quantity(message: types.Message, state: FSMContext):
    txt = message.text.strip().replace(" ", "")
    if not txt.isdigit():
        await message.answer("⚠️ Iltimos, faqat butun raqam kiriting! (Masalan: 1000)")
        return
    
    qty = int(txt)
    data = await state.get_data()
    min_q = data["min_qty"]
    max_q = data["max_qty"]
    
    if qty < min_q or qty > max_q:
        await message.answer(f"⚠️ Miqdor {min_q:,} va {max_q:,} orasida bo'lishi kerak!".replace(",", " "))
        return
    
    total_price = int((qty / 1000.0) * data["price_per_1000"])
    await state.update_data(quantity=qty, total_price=total_price)
    
    user = await db.get_user(message.from_user.id)
    user_balance = user["balance"] if user else 0
    
    p_str = f"{total_price:,}".replace(",", " ")
    b_str = f"{user_balance:,}".replace(",", " ")
    
    if user_balance < total_price:
        lack = total_price - user_balance
        lack_str = f"{lack:,}".replace(",", " ")
        text = (
            f"❌ **Mablag' yetarli emas!**\n\n"
            f"🔹 Buyurtma narxi: **{p_str} so'm**\n"
            f"💰 Sizning balansingiz: **{b_str} so'm**\n"
            f"⚠️ Yetishmayotgan summa: **{lack_str} so'm**\n\n"
            f"Iltimos, avval balansingizni to'ldiring:"
        )
        kb = [
            [InlineKeyboardButton(text="💳 Balansni to'ldirish", callback_data="deposit_start")],
            [InlineKeyboardButton(text="❌ Bekor qilish", callback_data="cancel_order")]
        ]
        await message.answer(text, parse_mode="Markdown", reply_markup=InlineKeyboardMarkup(inline_keyboard=kb))
        await state.clear()
        return

    # User has enough balance
    confirm_text = (
        f"📋 **Buyurtmani tasdiqlaysizmi?**\n\n"
        f"🔹 **Xizmat:** {data['service_name']}\n"
        f"🔗 **Havola:** {data['target_link']}\n"
        f"🔢 **Miqdor:** {qty:,} ta\n"
        f"💵 **Jami summa:** **{p_str} so'm**\n\n"
        f"💰 Sizning balansingiz: {b_str} so'm\n"
        f"Buyurtma berilgach, mablag' balansingizdan avtomatik yechiladi."
    ).replace(",", " ")
    
    kb = [
        [InlineKeyboardButton(text="✅ Ha, buyurtma berish", callback_data="confirm_order_now")],
        [InlineKeyboardButton(text="❌ Bekor qilish", callback_data="cancel_order")]
    ]
    await message.answer(confirm_text, parse_mode="Markdown", reply_markup=InlineKeyboardMarkup(inline_keyboard=kb))

@dp.callback_query(F.data == "confirm_order_now")
async def confirm_order_execution(callback: types.CallbackQuery, state: FSMContext):
    data = await state.get_data()
    user = callback.from_user
    
    # Double check balance
    user_db = await db.get_user(user.id)
    if not user_db or user_db["balance"] < data.get("total_price", 0):
        await callback.answer("Mablag' yetarli emas!", show_alert=True)
        await state.clear()
        return
    
    order_id = await db.create_order(
        user_id=user.id,
        service_id=data["service_id"],
        service_name=data["service_name"],
        target_link=data["target_link"],
        quantity=data["quantity"],
        total_price=data["total_price"]
    )
    
    await state.clear()
    
    p_str = f"{data['total_price']:,}".replace(",", " ")
    new_user = await db.get_user(user.id)
    new_b = f"{new_user['balance']:,}".replace(",", " ")
    
    success_text = (
        f"🎉 **Buyurtmangiz qabul qilindi!** (ID: `#{order_id}`)\n\n"
        f"🔹 Xizmat: {data['service_name']}\n"
        f"🔗 Havola: {data['target_link']}\n"
        f"🔢 Miqdor: {data['quantity']:,} ta\n"
        f"💰 Balansingizdan yechildi: **{p_str} so'm**\n"
        f"💵 Qolgan balans: **{new_b} so'm**\n\n"
        f"Buyurtmangiz administratorga uzatildi. Tez orada to'liq bajariladi! 🚀"
    ).replace(",", " ")
    await callback.message.edit_text(success_text, parse_mode="Markdown")
    await callback.answer()
    
    # Notify Admin
    settings = await db.get_settings()
    admin_id = int(settings.get("admin_id", 0))
    if admin_id != 0:
        admin_order_text = (
            f"🔔 **YANGI BUYURTMA #{order_id}!**\n\n"
            f"👤 **Mijoz:** {user.full_name} (@{user.username or 'yoq'}, ID: `{user.id}`)\n"
            f"📌 **Xizmat:** {data['service_name']}\n"
            f"🔗 **Havola:** {data['target_link']}\n"
            f"🔢 **Miqdor:** {data['quantity']:,} ta\n"
            f"💰 **Yechilgan summa:** **{p_str} so'm** (Balansdan to'landi ✅)\n\n"
            f"Bajarib bo'lgach '✅ Bajarildi' tugmasini bosing 👇"
        ).replace(",", " ")
        
        admin_kb = InlineKeyboardMarkup(inline_keyboard=[
            [
                InlineKeyboardButton(text="✅ Bajarildi", callback_data=f"adm_done_{order_id}"),
                InlineKeyboardButton(text="❌ Rad etish (Pul qaytarish)", callback_data=f"adm_reject_{order_id}")
            ]
        ])
        try:
            await bot.send_message(chat_id=admin_id, text=admin_order_text, parse_mode="Markdown", reply_markup=admin_kb)
        except Exception as e:
            logger.error(f"Error sending order to admin: {e}")

@dp.callback_query(F.data == "cancel_order")
async def cancel_order_handler(callback: types.CallbackQuery, state: FSMContext):
    await state.clear()
    await callback.message.edit_text("❌ Bekor qilindi.")
    await callback.answer()

# Admin Actions on Orders
@dp.callback_query(F.data.startswith("adm_done_"))
async def admin_approve_order(callback: types.CallbackQuery):
    is_admin = await check_is_admin(callback.from_user.id)
    if not is_admin:
        await callback.answer("Siz admin emassiz!", show_alert=True)
        return
    
    order_id = int(callback.data.split("_")[2])
    order = await db.get_order_by_id(order_id)
    if not order:
        await callback.answer("Buyurtma topilmadi!", show_alert=True)
        return
    
    await db.update_order_status(order_id, "completed")
    
    try:
        user_msg = (
            f"🎉 **Buyurtmangiz muvaffaqiyatli bajarildi!**\n\n"
            f"Buyurtma: `#{order_id}`\n"
            f"Xizmat: {order['service_name']}\n"
            f"Havola: {order['target_link']}\n"
            f"Miqdor: {order['quantity']:,} ta\n\n"
            f"Xizmatimizdan foydalanganingiz uchun rahmat! 😊"
        ).replace(",", " ")
        await bot.send_message(chat_id=order["user_id"], text=user_msg, parse_mode="Markdown")
    except Exception as e:
        logger.error(f"Could not notify user: {e}")
    
    await callback.message.edit_text(
        text=f"{callback.message.text}\n\n✅ **ADMIN TOMONIDAN BAJARILDI!**",
        reply_markup=None
    )
    await callback.answer("Buyurtma bajarildi!", show_alert=True)

@dp.callback_query(F.data.startswith("adm_reject_"))
async def admin_reject_order(callback: types.CallbackQuery, state: FSMContext):
    is_admin = await check_is_admin(callback.from_user.id)
    if not is_admin:
        await callback.answer("Siz admin emassiz!", show_alert=True)
        return
    
    order_id = int(callback.data.split("_")[2])
    await state.update_data(reject_order_id=order_id)
    await callback.message.answer(f"Iltimos, #{order_id} buyurtmani rad etish sababini yozing (Mijozning balansi to'liq qaytariladi):")
    await state.set_state(AdminRejectState.entering_reason)
    await callback.answer()

@dp.message(AdminRejectState.entering_reason)
async def process_reject_reason(message: types.Message, state: FSMContext):
    data = await state.get_data()
    order_id = data.get("reject_order_id")
    reason = message.text.strip()
    
    order = await db.get_order_by_id(order_id)
    if order:
        await db.update_order_status(order_id, "rejected", admin_notes=reason)
        # Automatic refund to user's balance!
        await db.refund_order(order_id)
        
        try:
            refund_str = f"{order['total_price']:,}".replace(",", " ")
            user_msg = (
                f"❌ **Buyurtmangiz rad etildi!**\n\n"
                f"Buyurtma: `#{order_id}`\n"
                f"Xizmat: {order['service_name']}\n"
                f"Sabab: {reason}\n\n"
                f"💰 **{refund_str} so'm mablag' balansingizga to'liq qaytarildi!**"
            )
            await bot.send_message(chat_id=order["user_id"], text=user_msg, parse_mode="Markdown")
        except Exception as e:
            logger.error(f"Error notifying user: {e}")
    
    await state.clear()
    await message.answer(f"✅ #{order_id} buyurtma rad etildi, mablag' mijoz balansiga qaytarildi.")

# User info buttons
@dp.message(F.text == "📋 Buyurtmalarim")
async def show_my_orders(message: types.Message):
    orders = await db.get_user_orders(message.from_user.id)
    if not orders:
        await message.answer("Sizda hali buyurtmalar yo'q.")
        return
    
    status_emoji = {
        "pending": "⏳ Jarayonda / Ko'rib chiqilmoqda",
        "completed": "✅ Bajarildi",
        "rejected": "❌ Bekor qilingan (Mablag' qaytarilgan)"
    }
    
    lines = ["📋 **Sizning so'nggi buyurtmalaringiz:**\n"]
    for o in orders:
        st = status_emoji.get(o['status'], o['status'])
        lines.append(
            f"🔹 **#{o['id']}** | {o['service_name']}\n"
            f"• Miqdor: {o['quantity']:,} ta | Summa: {o['total_price']:,} so'm\n"
            f"• Holati: **{st}**\n"
        )
    await message.answer("\n".join(lines).replace(",", " "), parse_mode="Markdown")

@dp.message(F.text == "💳 To'lov rekvizitlari")
async def show_payment_info(message: types.Message):
    settings = await db.get_settings()
    card = settings.get("card_number", "8600 0000 0000 0000")
    holder = settings.get("card_holder", "ADMIN")
    
    text = (
        f"💳 **To'lov rekvizitlari:**\n\n"
        f"Karta raqami:\n`{card}`\n\n"
        f"Karta egasi: **{holder}**\n\n"
        f"To'lovni **Click, Payme, Uzum Bank** orqali amalga oshirishingiz mumkin."
    )
    await message.answer(text, parse_mode="Markdown")

@dp.message(F.text == "📞 Yordam")
async def show_support(message: types.Message):
    settings = await db.get_settings()
    support = settings.get("support_username", "@admin")
    await message.answer(f"Savollaringiz yoki takliflaringiz bo'lsa, administratorga murojaat qiling:\n👉 {support}")

@dp.message(F.text == "ℹ️ Qoidalar")
async def show_rules(message: types.Message):
    rules = (
        "📖 **Foydalanish qoidalari:**\n\n"
        "1. Buyurtma berishdan oldin kiritayotgan kanalingiz yoki profilingiz OCHIQ (Public) ekanligiga ishonch hosil qiling.\n"
        "2. Hisobingizni to'ldirish uchun 'Balans / To'ldirish' bo'limidan foydalaning.\n"
        "3. Buyurtmalar odatda 5 daqiqadan bir necha soatgacha to'liq bajariladi.\n"
        "4. Agar buyurtmada xatolik bo'lsa, adminga murojaat qiling, mablag' balansingizga qaytariladi."
    )
    await message.answer(rules, parse_mode="Markdown")

# Admin Panel Handlers
@dp.message(F.text == "⚙️ Admin Panel")
@dp.message(Command("admin"))
async def admin_panel(message: types.Message):
    is_admin = await check_is_admin(message.from_user.id)
    if not is_admin:
        await message.answer("Sizda admin huquqi yo'q!")
        return
    
    stats = await db.get_stats()
    text = (
        f"👑 **ADMIN BOSHQARUV PANELI**\n\n"
        f"👥 Foydalanuvchilar: **{stats['total_users']}** ta\n"
        f"💳 Kutilayotgan to'lovlar (Cheklar): **{stats.get('pending_deposits', 0)}** ta\n"
        f"⏳ Bajarilishi kerak buyurtmalar: **{stats['pending_orders']}** ta\n"
        f"✅ Bajarilgan buyurtmalar: **{stats['completed_orders']}** ta\n"
        f"💰 Bajarilgan umumiy tushum: **{stats['total_revenue']:,} so'm**\n"
    ).replace(",", " ")
    
    kb = [
        [InlineKeyboardButton(text="➕ Yangi xizmat qo'shish", callback_data="adm_add_service")],
        [InlineKeyboardButton(text="🏷 Narxlarni sozlash / o'zgartirish", callback_data="adm_manage_prices")],
        [InlineKeyboardButton(text="🎛 Xizmatlarni yoqish / o'chirish", callback_data="adm_list_services")],
        [InlineKeyboardButton(text="💳 Karta raqamini o'zgartirish", callback_data="adm_change_card")],
        [InlineKeyboardButton(text="📢 Barchaga xabar yuborish (Xabarnoma)", callback_data="adm_broadcast")]
    ]
    await message.answer(text, parse_mode="Markdown", reply_markup=InlineKeyboardMarkup(inline_keyboard=kb))

@dp.callback_query(F.data == "adm_change_card")
async def change_card_prompt(callback: types.CallbackQuery, state: FSMContext):
    is_admin = await check_is_admin(callback.from_user.id)
    if not is_admin:
        return
    
    await callback.message.answer(
        "Karta raqami va egasini quyidagi formatda yuboring:\n\n"
        "`8600123456789012 - AZIZBEK RAHIMOV`",
        parse_mode="Markdown"
    )
    await state.set_state(AdminCardState.entering_card)
    await callback.answer()

@dp.message(AdminCardState.entering_card)
async def save_new_card(message: types.Message, state: FSMContext):
    text = message.text.strip()
    if "-" in text:
        parts = text.split("-")
        card = parts[0].strip()
        holder = parts[1].strip()
    else:
        card = text
        holder = "ADMIN"
    
    await db.update_setting("card_number", card)
    await db.update_setting("card_holder", holder)
    await state.clear()
    await message.answer(f"✅ Karta ma'lumotlari yangilandi:\n💳 `{card}`\n👤 {holder}", parse_mode="Markdown")

@dp.callback_query(F.data == "adm_manage_prices")
async def manage_prices_handler(callback: types.CallbackQuery, state: FSMContext):
    is_admin = await check_is_admin(callback.from_user.id)
    if not is_admin:
        return
    
    services = await db.get_all_services_admin()
    kb = []
    for s in services:
        p_str = f"{s['price_per_1000']:,}".replace(",", " ")
        kb.append([InlineKeyboardButton(text=f"{s['name'][:28]}... ({p_str} so'm)", callback_data=f"adm_edit_prc_{s['id']}")])
    
    kb.append([InlineKeyboardButton(text="⬅️ Admin panelga qaytish", callback_data="adm_back_to_panel")])
    await callback.message.edit_text(
        "🛠 **Qaysi xizmat narxini o'zgartirmoqchisiz?**\nKerakli xizmat ustiga bosing:",
        parse_mode="Markdown",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=kb)
    )
    await callback.answer()

@dp.callback_query(F.data == "adm_back_to_panel")
async def back_to_admin_panel(callback: types.CallbackQuery, state: FSMContext):
    await state.clear()
    stats = await db.get_stats()
    text = (
        f"👑 **ADMIN BOSHQARUV PANELI**\n\n"
        f"👥 Foydalanuvchilar: **{stats['total_users']}** ta\n"
        f"💳 Kutilayotgan to'lovlar (Cheklar): **{stats.get('pending_deposits', 0)}** ta\n"
        f"⏳ Bajarilishi kerak buyurtmalar: **{stats['pending_orders']}** ta\n"
        f"✅ Bajarilgan buyurtmalar: **{stats['completed_orders']}** ta\n"
        f"💰 Bajarilgan umumiy tushum: **{stats['total_revenue']:,} so'm**\n"
    ).replace(",", " ")
    
    kb = [
        [InlineKeyboardButton(text="➕ Yangi xizmat qo'shish", callback_data="adm_add_service")],
        [InlineKeyboardButton(text="🏷 Narxlarni sozlash / o'zgartirish", callback_data="adm_manage_prices")],
        [InlineKeyboardButton(text="🎛 Xizmatlarni yoqish / o'chirish", callback_data="adm_list_services")],
        [InlineKeyboardButton(text="💳 Karta raqamini o'zgartirish", callback_data="adm_change_card")],
        [InlineKeyboardButton(text="📢 Barchaga xabar yuborish (Xabarnoma)", callback_data="adm_broadcast")]
    ]
    await callback.message.edit_text(text, parse_mode="Markdown", reply_markup=InlineKeyboardMarkup(inline_keyboard=kb))
    await callback.answer()

@dp.callback_query(F.data.startswith("adm_edit_prc_"))
async def select_service_for_price(callback: types.CallbackQuery, state: FSMContext):
    is_admin = await check_is_admin(callback.from_user.id)
    if not is_admin:
        return
    
    srv_id = int(callback.data.split("_")[3])
    service = await db.get_service_by_id(srv_id)
    if not service:
        await callback.answer("Xizmat topilmadi!", show_alert=True)
        return
    
    await state.update_data(edit_service_id=srv_id, edit_service_name=service["name"])
    current_price = f"{service['price_per_1000']:,}".replace(",", " ")
    msg = (
        f"📌 **Xizmat:** {service['name']}\n"
        f"💵 **Hozirgi narxi (1000 ta uchun):** {current_price} so'm\n\n"
        f"✍️ **Yangi narxni so'mda kiriting (1000 ta uchun):**\n"
        f"*(Masalan: `20000` yoki `15000`)*"
    )
    cancel_kb = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="❌ Bekor qilish", callback_data="adm_manage_prices")]])
    await callback.message.edit_text(msg, parse_mode="Markdown", reply_markup=cancel_kb)
    await state.set_state(AdminPriceState.entering_new_price)
    await callback.answer()

@dp.message(AdminPriceState.entering_new_price)
async def save_new_price(message: types.Message, state: FSMContext):
    txt = message.text.strip().replace(" ", "")
    if not txt.isdigit():
        await message.answer("⚠️ Iltimos, narxni faqat butun sonda kiriting! (Masalan: `25000`)")
        return
    
    new_price = int(txt)
    data = await state.get_data()
    srv_id = data.get("edit_service_id")
    srv_name = data.get("edit_service_name")
    
    await db.update_service_price(srv_id, new_price)
    await state.clear()
    
    p_str = f"{new_price:,}".replace(",", " ")
    await message.answer(
        f"✅ **Xizmat narxi yangilandi!**\n\n"
        f"📌 **{srv_name}**\n"
        f"💰 Yangi narx: **{p_str} so'm** (1000 ta uchun)",
        parse_mode="Markdown"
    )

# ➕ Admin: Add New Service Handlers
@dp.callback_query(F.data == "adm_add_service")
async def add_service_start(callback: types.CallbackQuery, state: FSMContext):
    is_admin = await check_is_admin(callback.from_user.id)
    if not is_admin:
        return
    
    kb = [
        [
            InlineKeyboardButton(text="✈️ Telegram", callback_data="addcat_telegram"),
            InlineKeyboardButton(text="📸 Instagram", callback_data="addcat_instagram")
        ],
        [
            InlineKeyboardButton(text="🎵 TikTok", callback_data="addcat_tiktok"),
            InlineKeyboardButton(text="🔴 YouTube", callback_data="addcat_youtube")
        ],
        [InlineKeyboardButton(text="⬅️ Bekor qilish", callback_data="adm_back_to_panel")]
    ]
    await callback.message.edit_text(
        "➕ **Yangi xizmat qo'shish:**\n\nYangi xizmat qaysi tarmoqqa tegishli bo'lsin?",
        parse_mode="Markdown",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=kb)
    )
    await callback.answer()

@dp.callback_query(F.data.startswith("addcat_"))
async def add_service_category_chosen(callback: types.CallbackQuery, state: FSMContext):
    category = callback.data.split("_")[1]
    await state.update_data(new_category=category)
    
    cancel_kb = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="❌ Bekor qilish", callback_data="adm_back_to_panel")]])
    await callback.message.edit_text(
        f"✍️ **Xizmat nomini kiriting:**\n"
        f"*(Masalan: `⚡ Telegram Tezkor Reaksiyalar`)*",
        parse_mode="Markdown",
        reply_markup=cancel_kb
    )
    await state.set_state(AdminNewServiceState.entering_name)
    await callback.answer()

@dp.message(AdminNewServiceState.entering_name)
async def add_service_name(message: types.Message, state: FSMContext):
    name = message.text.strip()
    await state.update_data(new_name=name)
    
    cancel_kb = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="❌ Bekor qilish", callback_data="adm_back_to_panel")]])
    await message.answer(
        f"💰 **1 000 ta uchun narxini so'mda kiriting:**\n"
        f"*(Masalan: `20000`)*",
        parse_mode="Markdown",
        reply_markup=cancel_kb
    )
    await state.set_state(AdminNewServiceState.entering_price)

@dp.message(AdminNewServiceState.entering_price)
async def add_service_price(message: types.Message, state: FSMContext):
    txt = message.text.strip().replace(" ", "")
    if not txt.isdigit():
        await message.answer("⚠️ Iltimos, narxni butun sonda kiriting! (Masalan: `20000`)")
        return
    
    await state.update_data(new_price=int(txt))
    cancel_kb = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="❌ Bekor qilish", callback_data="adm_back_to_panel")]])
    await message.answer(
        f"📉 **Minimal buyurtma miqdorini kiriting:**\n"
        f"*(Masalan: `100`)*",
        parse_mode="Markdown",
        reply_markup=cancel_kb
    )
    await state.set_state(AdminNewServiceState.entering_min_qty)

@dp.message(AdminNewServiceState.entering_min_qty)
async def add_service_min(message: types.Message, state: FSMContext):
    txt = message.text.strip().replace(" ", "")
    if not txt.isdigit():
        await message.answer("⚠️ Iltimos, minimal sonni butun sonda kiriting! (Masalan: `100`)")
        return
    
    await state.update_data(new_min_qty=int(txt))
    cancel_kb = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="❌ Bekor qilish", callback_data="adm_back_to_panel")]])
    await message.answer(
        f"📈 **Maksimal buyurtma miqdorini kiriting:**\n"
        f"*(Masalan: `50000`)*",
        parse_mode="Markdown",
        reply_markup=cancel_kb
    )
    await state.set_state(AdminNewServiceState.entering_max_qty)

@dp.message(AdminNewServiceState.entering_max_qty)
async def add_service_max(message: types.Message, state: FSMContext):
    txt = message.text.strip().replace(" ", "")
    if not txt.isdigit():
        await message.answer("⚠️ Iltimos, maksimal sonni butun sonda kiriting! (Masalan: `50000`)")
        return
    
    await state.update_data(new_max_qty=int(txt))
    cancel_kb = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="❌ Bekor qilish", callback_data="adm_back_to_panel")]])
    await message.answer(
        f"📝 **Xizmat uchun qisqacha tavsif (izoh) yozing:**\n"
        f"*(Masalan: `Kafolatli va tez tushuvchi sifatli obunachilar.`)*",
        parse_mode="Markdown",
        reply_markup=cancel_kb
    )
    await state.set_state(AdminNewServiceState.entering_desc)

@dp.message(AdminNewServiceState.entering_desc)
async def add_service_finish(message: types.Message, state: FSMContext):
    desc = message.text.strip()
    data = await state.get_data()
    
    await db.add_service(
        category=data["new_category"],
        name=data["new_name"],
        price_per_1000=data["new_price"],
        min_quantity=data["new_min_qty"],
        max_quantity=data["new_max_qty"],
        description=desc
    )
    
    p_str = f"{data['new_price']:,}".replace(",", " ")
    await state.clear()
    await message.answer(
        f"🎉 **Yangi xizmat muvaffaqiyatli qo'shildi!**\n\n"
        f"🌐 Bo'lim: **{data['new_category'].upper()}**\n"
        f"📌 Xizmat: **{data['new_name']}**\n"
        f"💰 Narxi: **{p_str} so'm** / 1000 ta\n"
        f"📊 Miqdor: {data['new_min_qty']} - {data['new_max_qty']} ta\n"
        f"📝 Izoh: {desc}\n\n"
        f"Mijozlar endi ushbu yangi xizmatga buyurtma bera oladi.",
        parse_mode="Markdown"
    )

# 🎛 Admin: Toggle or Delete Services
@dp.callback_query(F.data == "adm_list_services")
async def list_services_for_management(callback: types.CallbackQuery):
    is_admin = await check_is_admin(callback.from_user.id)
    if not is_admin:
        return
    
    services = await db.get_all_services_admin()
    kb = []
    for s in services:
        status_icon = "🟢" if s.get("is_active", 1) == 1 else "🔴"
        btn_text = f"{status_icon} {s['name'][:26]}"
        kb.append([InlineKeyboardButton(text=btn_text, callback_data=f"adm_manage_srv_{s['id']}")])
    
    kb.append([InlineKeyboardButton(text="⬅️ Admin panelga qaytish", callback_data="adm_back_to_panel")])
    await callback.message.edit_text(
        "🎛 **Xizmatlar holatini boshqarish:**\n\n"
        "🟢 = Faol (mijozlar ko'radi)\n"
        "🔴 = O'chirilgan (mijozlarga ko'rinmaydi)\n\n"
        "Boshqarish uchun xizmat ustiga bosing:",
        parse_mode="Markdown",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=kb)
    )
    await callback.answer()

@dp.callback_query(F.data.startswith("adm_manage_srv_"))
async def manage_specific_service(callback: types.CallbackQuery):
    is_admin = await check_is_admin(callback.from_user.id)
    if not is_admin:
        return
    
    srv_id = int(callback.data.split("_")[3])
    service = await db.get_service_by_id(srv_id)
    if not service:
        await callback.answer("Xizmat topilmadi!", show_alert=True)
        return
    
    is_active = service.get("is_active", 1)
    status_str = "🟢 Faol" if is_active == 1 else "🔴 O'chirilgan"
    toggle_btn_text = "🔴 Xizmatni o'chirib qo'yish" if is_active == 1 else "🟢 Xizmatni yoqish"
    
    kb = [
        [InlineKeyboardButton(text=toggle_btn_text, callback_data=f"adm_toggle_srv_{srv_id}")],
        [InlineKeyboardButton(text="🗑 Butunlay o'chirib tashlash", callback_data=f"adm_del_srv_{srv_id}")],
        [InlineKeyboardButton(text="⬅️ Ro'yxatga qaytish", callback_data="adm_list_services")]
    ]
    
    p_str = f"{service['price_per_1000']:,}".replace(",", " ")
    text = (
        f"⚙️ **Xizmat sozlamalari:**\n\n"
        f"📌 Nomi: **{service['name']}**\n"
        f"🌐 Tarmoq: {service['category'].upper()}\n"
        f"💰 Narxi: {p_str} so'm / 1000 ta\n"
        f"📊 Holati: **{status_str}**"
    )
    await callback.message.edit_text(text, parse_mode="Markdown", reply_markup=InlineKeyboardMarkup(inline_keyboard=kb))
    await callback.answer()

@dp.callback_query(F.data.startswith("adm_toggle_srv_"))
async def toggle_service_action(callback: types.CallbackQuery):
    is_admin = await check_is_admin(callback.from_user.id)
    if not is_admin:
        return
    
    srv_id = int(callback.data.split("_")[3])
    await db.toggle_service_status(srv_id)
    await callback.answer("Xizmat holati o'zgartirildi!", show_alert=True)
    await manage_specific_service(callback)

@dp.callback_query(F.data.startswith("adm_del_srv_"))
async def delete_service_action(callback: types.CallbackQuery):
    is_admin = await check_is_admin(callback.from_user.id)
    if not is_admin:
        return
    
    srv_id = int(callback.data.split("_")[3])
    await db.delete_service(srv_id)
    await callback.answer("Xizmat butunlay o'chirib tashlandi!", show_alert=True)
    await list_services_for_management(callback)

@dp.callback_query(F.data == "adm_broadcast")
async def broadcast_prompt(callback: types.CallbackQuery, state: FSMContext):
    is_admin = await check_is_admin(callback.from_user.id)
    if not is_admin:
        return
    
    await callback.message.answer("Barcha foydalanuvchilarga yubormoqchi bo'lgan xabaringiz matnini kiriting:")
    await state.set_state(AdminBroadcastState.entering_text)
    await callback.answer()

@dp.message(AdminBroadcastState.entering_text)
async def process_broadcast(message: types.Message, state: FSMContext):
    user_ids = await db.get_all_user_ids()
    sent_count = 0
    msg_text = message.text
    
    progress_msg = await message.answer(f"Xabar yuborilmoqda: 0/{len(user_ids)}...")
    for uid in user_ids:
        try:
            await bot.send_message(chat_id=uid, text=msg_text)
            sent_count += 1
            await asyncio.sleep(0.05)
        except Exception:
            pass
    
    await state.clear()
    await progress_msg.edit_text(f"✅ Xabar muvaffaqiyatli {sent_count}/{len(user_ids)} foydalanuvchiga yuborildi.")

async def main():
    await db.init_db()
    logger.info("Database initialized successfully.")
    
    await bot.delete_webhook(drop_pending_updates=True)
    logger.info("Bot started polling...")
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())
