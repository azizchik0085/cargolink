from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.entities import Notification, User

router = APIRouter(prefix="/notifications", tags=["Notifications"])

@router.get("/")
async def get_my_notifications(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Notification).where(Notification.user_id == current_user.id).order_by(Notification.created_at.desc()).limit(50)
    res = await db.execute(stmt)
    notifications = res.scalars().all()
    return [{
        "id": n.id,
        "title": n.title,
        "message": n.message,
        "event_type": n.event_type,
        "link_url": n.link_url,
        "is_read": n.is_read,
        "created_at": n.created_at.isoformat()
    } for n in notifications]

@router.put("/{notification_id}/read")
async def mark_notification_as_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Notification).where(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    )
    res = await db.execute(stmt)
    notif = res.scalar_one_or_none()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    notif.is_read = True
    await db.commit()
    return {"success": True, "message": "Notification marked as read"}
