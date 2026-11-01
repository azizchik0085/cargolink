from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Dict, List, Optional
from datetime import datetime
import json

from app.core.database import get_db, AsyncSessionLocal
from app.core.security import decode_token
from app.models.entities import Conversation, Message, User

router = APIRouter(prefix="/chat", tags=["Real-time Messaging"])

class ConnectionManager:
    def __init__(self):
        # Maps user_id -> List of active WebSockets
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, user_id: str, websocket: WebSocket):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)

    def disconnect(self, user_id: str, websocket: WebSocket):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def send_personal_message(self, message: dict, user_id: str):
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_text(json.dumps(message))
                except Exception:
                    pass

manager = ConnectionManager()

@router.websocket("/ws")
async def websocket_chat_endpoint(websocket: WebSocket, token: Optional[str] = None):
    # Verify token
    if not token:
        await websocket.close(code=1008)
        return
    payload = decode_token(token)
    if not payload:
        await websocket.close(code=1008)
        return
    user_id = payload.get("sub")
    if not user_id:
        await websocket.close(code=1008)
        return

    await manager.connect(user_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            msg_payload = json.loads(data)
            
            recipient_id = msg_payload.get("recipient_id")
            text = msg_payload.get("text")
            conversation_id = msg_payload.get("conversation_id")

            # Persist to database
            async with AsyncSessionLocal() as db:
                # Find or create conversation
                if not conversation_id and recipient_id:
                    conv = Conversation()
                    db.add(conv)
                    await db.flush()
                    conversation_id = conv.id

                new_msg = Message(
                    conversation_id=conversation_id,
                    sender_id=user_id,
                    text=text,
                    created_at=datetime.utcnow()
                )
                db.add(new_msg)
                await db.commit()

            # Push real-time to recipient if online
            if recipient_id:
                outbound = {
                    "event": "NEW_MESSAGE",
                    "conversation_id": conversation_id,
                    "sender_id": user_id,
                    "text": text,
                    "created_at": datetime.utcnow().isoformat()
                }
                await manager.send_personal_message(outbound, recipient_id)
                # Echo back to sender
                await manager.send_personal_message(outbound, user_id)

    except WebSocketDisconnect:
        manager.disconnect(user_id, websocket)
    except Exception:
        manager.disconnect(user_id, websocket)

@router.get("/history/{conversation_id}")
async def get_chat_history(conversation_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(Message).where(Message.conversation_id == conversation_id).order_by(Message.created_at.asc())
    res = await db.execute(stmt)
    messages = res.scalars().all()
    return [{
        "id": m.id,
        "sender_id": m.sender_id,
        "text": m.text,
        "is_read": m.is_read,
        "created_at": m.created_at.isoformat()
    } for m in messages]
