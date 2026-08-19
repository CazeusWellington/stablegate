import { Server } from 'socket.io'

export function initSocketHandlers(io: Server) {
  io.on('connection', (socket) => {
    // Join a race room for real-time updates
    socket.on('race:join', (raceId: string) => {
      socket.join(`race:${raceId}`)
    })

    socket.on('race:leave', (raceId: string) => {
      socket.leave(`race:${raceId}`)
    })

    // Join user room for personal notifications
    socket.on('user:join', (userId: string) => {
      socket.join(`user:${userId}`)
    })

    socket.on('disconnect', () => {})
  })
}

// Typed event emitters for use throughout the app
export const SocketEvents = {
  RACE_FILL_UPDATE: 'race:fill_update',
  RACE_AUCTION_OPENED: 'race:auction_opened',
  RACE_AUCTION_RESOLVED: 'race:auction_resolved',
  RACE_SIMULATING: 'race:simulating',
  RACE_COMPLETED: 'race:completed',
  TRAIT_UNLOCKED: 'horse:trait_unlocked',
  USER_NOTIFICATION: 'user:notification',
}
