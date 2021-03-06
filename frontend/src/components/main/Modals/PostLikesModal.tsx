import { CloseOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import Modal from 'react-modal';
import Loader from '~/components/shared/Loader';
import { getPostLikes } from '~/services/api';
import { IError, IUser } from '~/types/types';
import UserCard from '../UserCard';

interface IProps {
    isOpen: boolean;
    onAfterOpen?: () => void;
    closeModal: () => void;
    openModal: () => void;
    postID: string;
}

Modal.setAppElement('#root');

type TLikesState = IUser & { isFollowing: boolean };

const PostLikesModal: React.FC<IProps> = (props) => {
    const [likes, setLikes] = useState<TLikesState[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [offset, setOffset] = useState(0);
    const [error, setError] = useState<IError | null>(null);

    useEffect(() => {
        if (props.isOpen) {
            fetchLikes();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.isOpen]);

    const fetchLikes = async (initOffset = 0) => {
        try {
            setIsLoading(true);
            const result = await getPostLikes(props.postID, { offset: initOffset });

            setOffset(offset + 1);
            setLikes(result);
            setIsLoading(false);
        } catch (e) {
            setIsLoading(false);
            setError(e);
        }
    };

    return (
        <Modal
            isOpen={props.isOpen}
            onAfterOpen={props.onAfterOpen}
            onRequestClose={props.closeModal}
            contentLabel="Example Modal"
            className="modal"
            shouldCloseOnOverlayClick={true}
            overlayClassName="modal-overlay"
        >
            <div className="relative transition-all min-w-15rem">
                <div
                    className="absolute right-2 top-2 p-1 rounded-full flex items-center justify-center cursor-pointer hover:bg-gray-200"
                    onClick={props.closeModal}
                >
                    <CloseOutlined className="p-2  outline-none text-gray-500" />
                </div>
                {(error && likes.length === 0) && (
                    <span className="p-4 bg-red-100 text-red-500 block">
                        {error.error.message}
                    </span>
                )}
                <h3 className="py-4 px-8">Likes</h3>
                {(isLoading && likes.length === 0) && (
                    <div className="flex min-h-10rem min-w-15rem items-center justify-center py-8">
                        <Loader />
                    </div>
                )}
                {likes.length !== 0 && (
                    <div className="p-4 px-4 w-30rem max-h-70vh overflow-y-scroll">
                        <div className="divide-y divide-gray-100">
                            {likes.map(user => (
                                <div key={user.id}>
                                    <UserCard profile={user} isFollowing={user.isFollowing} />
                                </div>
                            ))}
                        </div>
                        {(!isLoading && likes.length >= 10) && (
                            <div className="flex items-center justify-center pt-2 border-t border-gray-100">
                                <span className="text-indigo-700 text-sm font-medium cursor-pointer">
                                    Load more
                                </span>
                            </div>
                        )}
                        {error && (
                            <div className="flex items-center justify-center py-8">
                                <span className="text-gray-400 text-sm">No more likes.</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

        </Modal>
    );
};

export default PostLikesModal;
