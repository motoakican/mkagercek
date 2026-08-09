import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { errorEmbed, successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { getGuildGiveaways, saveGiveaway } from '../../utils/giveaways.js';
import { 
    endGiveaway as endGiveawayService,
    createGiveawayEmbed, 
    createGiveawayButtons 
} from '../../services/giveawayService.js';
import { logEvent, EVENT_TYPES } from '../../services/loggingService.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName("cekilis-bitir")
        .setDescription(
            "Devam eden bir çekilişi hemen sonlandırır ve kazanan(lar)ı seçer.",
        )
        .addStringOption((option) =>
            option
                .setName("mesaj-id")
                .setDescription("Sonlandırılacak çekilişin mesaj ID'si.")
                .setRequired(true),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        if (!interaction.inGuild()) {
            throw new TitanBotError(
                'Giveaway command used outside guild',
                ErrorTypes.VALIDATION,
                'Bu komut yalnızca bir sunucuda kullanılabilir.',
                { userId: interaction.user.id }
            );
        }

        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            throw new TitanBotError(
                'User lacks ManageGuild permission',
                ErrorTypes.PERMISSION,
                "Bir çekilişi sonlandırmak için 'Sunucuyu Yönet' yetkisine ihtiyacınız var.",
                { userId: interaction.user.id, guildId: interaction.guildId }
            );
        }

        logger.info(`Çekiliş sonlandırma isteği ${interaction.user.tag} tarafından ${interaction.guildId} sunucusunda başlatıldı.`);

        const messageId = interaction.options.getString("mesaj-id");

        if (!messageId || !/^\d+$/.test(messageId)) {
            throw new TitanBotError(
                'Invalid message ID format',
                ErrorTypes.VALIDATION,
                'Lütfen geçerli bir mesaj ID\'si belirtin.',
                { providedId: messageId }
            );
        }

        const giveaways = await getGuildGiveaways(interaction.client, interaction.guildId);
        const giveaway = giveaways.find(g => g.messageId === messageId);

        if (!giveaway) {
            throw new TitanBotError(
                `Giveaway not found: ${messageId}`,
                ErrorTypes.VALIDATION,
                "Veritabanında bu mesaj ID'sine sahip bir çekiliş bulunamadı.",
                { messageId, guildId: interaction.guildId }
            );
        }

        const endResult = await endGiveawayService(
            interaction.client,
            giveaway,
            interaction.guildId,
            interaction.user.id
        );

        const updatedGiveaway = endResult.giveaway;
        const winners = endResult.winners;

        const channel = await interaction.client.channels.fetch(
            updatedGiveaway.channelId,
        ).catch(err => {
            logger.warn(`${updatedGiveaway.channelId} kanalı getirilemedi:`, err.message);
            return null;
        });

        if (!channel || !channel.isTextBased()) {
            throw new TitanBotError(
                `Channel not found: ${updatedGiveaway.channelId}`,
                ErrorTypes.VALIDATION,
                "Çekilişin düzenlendiği kanal bulunamadı. Çekiliş durumu güncellendi.",
                { channelId: updatedGiveaway.channelId, messageId }
            );
        }

        const message = await channel.messages
            .fetch(messageId)
            .catch(err => {
                logger.warn(`${messageId} mesajı getirilemedi:`, err.message);
                return null;
            });

        if (!message) {
            throw new TitanBotError(
                `Message not found: ${messageId}`,
                ErrorTypes.VALIDATION,
                "Çekiliş mesajı bulunamadı. Çekiliş durumu güncellendi.",
                { messageId, channelId: updatedGiveaway.channelId }
            );
        }

        await saveGiveaway(
            interaction.client,
            interaction.guildId,
            updatedGiveaway,
        );

        const newEmbed = createGiveawayEmbed(updatedGiveaway, "ended", winners);
        const newRow = createGiveawayButtons(true);

        await message.edit({
            content: "🎉 **ÇEKİLİŞ SONA ERDİ** 🎉",
            embeds: [newEmbed],
            components: [newRow],
        });

        if (winners.length > 0) {
            const winnerMentions = winners
                .map((id) => `<@${id}>`)
                .join(",");
            const winnerPingMsg = await channel.send({
                content: `🎉 TEBRİKLER ${winnerMentions}! **${updatedGiveaway.prize}** çekilişini kazandınız! Ödülünüzü almak için lütfen düzenleyen yetkiliyle iletişime geçin: <@${updatedGiveaway.hostId}>.`,
            });
            updatedGiveaway.winnerPingMessageId = winnerPingMsg.id;
            await saveGiveaway(interaction.client, interaction.guildId, updatedGiveaway);

            logger.info(`Çekiliş ${winners.length} kazananla sona erdi: ${messageId}`);

            try {
                await logEvent({
                    client: interaction.client,
                    guildId: interaction.guildId,
                    eventType: EVENT_TYPES.GIVEAWAY_WINNER,
                    data: {
                        description: `Çekiliş ${winners.length} kazananla sona erdi`,
                        channelId: channel.id,
                        userId: interaction.user.id,
                        fields: [
                            {
                                name: 'Ödül',
                                value: updatedGiveaway.prize || 'Gizemli Ödül!',
                                inline: true
                            },
                            {
                                name: 'Kazananlar',
                                value: winnerMentions,
                                inline: false
                            },
                            {
                                name: 'Katılımlar',
                                value: endResult.participantCount.toString(),
                                inline: true
                            }
                        ]
                    }
                });
            } catch (logError) {
                logger.debug('Çekiliş kazananı olayı loglanırken hata oluştu:', logError);
            }
        } else {
            await channel.send({
                content: `**${updatedGiveaway.prize}** için yapılan çekiliş geçerli katılım olmadan sona erdi.`,
            });
            logger.info(`Çekiliş kazanan olmadan sona erdi: ${messageId}`);
        }

        logger.info(`Çekiliş başarıyla ${interaction.user.tag} tarafından sonlandırıldı: ${messageId}`);

        return InteractionHelper.safeReply(interaction, {
            embeds: [
                successEmbed(
                    "Çekiliş Sona Erdi ✅",
                    `**${updatedGiveaway.prize}** çekilişi ${channel} kanalında başarıyla sonlandırıldı. ${endResult.participantCount} katılımcı arasından ${winners.length} kazanan seçildi.`,
                ),
            ],
            flags: MessageFlags.Ephemeral,
        });
    },
};